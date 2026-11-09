import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';
import { radius, useStyles, type Palette } from '@/lib/theme';

export default function Settings() {
  const styles = useStyles(createStyles);
  const { state } = useAuth();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  
  // Engine settings
  const [engines, setEngines] = useState<Array<{id: string; name: string; provider: string; model: string}>>([]);
  const [defaultEngineId, setDefaultEngineId] = useState<string | null>(null);
  
  // Workspace
  const [workspacePath, setWorkspacePath] = useState<string>('');
  
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  // Loading states
  const [loading, setLoading] = useState(true);

  if (state.status !== 'ready' || !api) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading settings…</Text>
      </View>
    );
  }

  // Load settings on mount
  const loadSettings = async () => {
    try {
      const [enginesList, defaultEngine, wsPath, currentTheme] = await Promise.all([
        api.enginesApi.list(),
        api.settingsApi.getDefaultEngine(),
        api.settingsApi.getWorkspaceRoot(),
        api.settingsApi.getTheme(),
      ]);
      setEngines(enginesList);
      setDefaultEngineId(defaultEngine);
      setWorkspacePath(wsPath || '');
      setTheme(currentTheme);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // We'll load in a useEffect but for now just render
  // In a real app, you'd use useEffect to load settings

  const handleAddEngine = async () => {
    // Navigate to engine setup - for now just alert
    Alert.alert('Add Engine', 'Engine configuration would be done in a dedicated screen');
  };

  const handleDeleteEngine = async (engineId: string) => {
    Alert.alert('Delete Engine', 'This will remove the engine configuration.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.enginesApi.delete(engineId);
          setEngines(prev => prev.filter(e => e.id !== engineId));
          if (defaultEngineId === engineId) setDefaultEngineId(null);
        } catch (err) {
          Alert.alert('Error', 'Failed to delete engine');
        }
      }},
    ]);
  };

  const handleSetDefaultEngine = async (engineId: string) => {
    try {
      await api.settingsApi.setDefaultEngine(engineId);
      setDefaultEngineId(engineId);
    } catch (err) {
      Alert.alert('Error', 'Failed to set default engine');
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      await api.settingsApi.setWorkspaceRoot(workspacePath);
      Alert.alert('Saved', 'Workspace path updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to save workspace path');
    }
  };

  const handleSaveTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    try {
      await api.settingsApi.setTheme(newTheme);
      setTheme(newTheme);
    } catch (err) {
      Alert.alert('Error', 'Failed to save theme');
    }
  };

  const handleResetApp = async () => {
    Alert.alert(
      'Reset Open Duet?',
      'This will delete all your agents, conversations, engines, memory, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          // Would need a reset function in the API
          Alert.alert('Not implemented', 'Reset functionality coming soon');
        }},
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading settings…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Engines Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Engines</Text>
        <Text style={styles.sectionDesc}>
          Configure API keys and models for your AI providers.
        </Text>
        
        {engines.length === 0 ? (
          <Text style={styles.empty}>No engines configured. Add one to get started.</Text>
        ) : (
          engines.map(engine => (
            <View key={engine.id} style={styles.engineCard}>
              <View style={styles.engineInfo}>
                <View style={[
                  styles.engineBadge,
                  { backgroundColor: defaultEngineId === engine.id ? styles.engineBadgeActive.backgroundColor : undefined }
                ]}>
                  <Text style={styles.engineProvider}>{engine.provider}</Text>
                  {defaultEngineId === engine.id && <Text style={styles.defaultBadge}>Default</Text>}
                </View>
                <View style={styles.engineDetails}>
                  <Text style={styles.engineName}>{engine.name}</Text>
                  <Text style={styles.engineModel}>{engine.model}</Text>
                </View>
              </View>
              <View style={styles.engineActions}>
                {defaultEngineId !== engine.id && (
                  <Pressable style={styles.actionButton} onPress={() => handleSetDefaultEngine(engine.id)}>
                    <Text style={styles.actionButtonText}>Set Default</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actionButton, styles.dangerButton]} onPress={() => handleDeleteEngine(engine.id)}>
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
        
        <Pressable style={styles.addButton} onPress={handleAddEngine}>
          <Text style={styles.addButtonText}>+ Add Engine</Text>
        </Pressable>
      </View>

      {/* Workspace Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <Text style={styles.sectionDesc}>
          The folder where agents read and write files.
        </Text>
        
        <View style={styles.field}>
          <Text style={styles.label}>Workspace Path</Text>
          <TextInput
            style={styles.input}
            value={workspacePath}
            onChangeText={setWorkspacePath}
            placeholder="/storage/emulated/0/Documents/openduet-workspace"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <Pressable style={styles.saveButton} onPress={handleSaveWorkspace}>
          <Text style={styles.saveButtonText}>Save Workspace Path</Text>
        </Pressable>
      </View>

      {/* Theme Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeOptions}>
          {(['light', 'dark', 'system'] as const).map(t => (
            <Pressable
              key={t}
              style={[
                styles.themeOption,
                theme === t && styles.themeOptionSelected
              ]}
              onPress={() => handleSaveTheme(t)}
            >
              <Text style={[
                styles.themeOptionText,
                theme === t && styles.themeOptionTextSelected
              ]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              <Text style={[
                styles.themeOptionDesc,
                theme === t && styles.themeOptionDescSelected
              ]}>
                {t === 'light' ? 'Always light' : t === 'dark' ? 'Always dark' : 'Follow system'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Pressable style={styles.dangerButtonFull} onPress={() => setShowReset(true)}>
          <Text style={styles.dangerButtonFullText}>Reset All Data</Text>
        </Pressable>
      </View>

      {showReset && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reset All Data?</Text>
            <Text style={styles.modalText}>
              This will permanently delete all your agents, conversations, engines, memory notes, routines, and settings. This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setShowReset(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => { setShowReset(false); handleResetApp(); }}>
                <Text style={styles.modalConfirmText}>Reset Everything</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (p: Palette) =>
  StyleSheet.create({
    container: { padding: 20, gap: 24 },
    loading: { textAlign: 'center', fontSize: 16, color: p.muted, marginTop: 40 },
    section: { gap: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: p.text },
    sectionDesc: { fontSize: 13, color: p.muted },
    empty: { fontSize: 14, color: p.muted, fontStyle: 'italic' },
    
    engineCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: p.surface, borderRadius: radius.field, borderWidth: 1, borderColor: p.inputBorder },
    engineInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    engineBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.small, backgroundColor: p.inputBorder },
    engineBadgeActive: { backgroundColor: p.accentBackground },
    engineProvider: { fontSize: 12, fontWeight: '600', color: p.text },
    defaultBadge: { fontSize: 10, fontWeight: '600', color: p.accent, marginLeft: 6 },
    engineDetails: { gap: 2 },
    engineName: { fontSize: 15, fontWeight: '600', color: p.text },
    engineModel: { fontSize: 13, color: p.muted },
    engineActions: { flexDirection: 'row', gap: 8 },
    actionButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: p.surface, borderRadius: radius.small, borderWidth: 1, borderColor: p.inputBorder },
    actionButtonText: { fontSize: 13, fontWeight: '500', color: p.text },
    dangerButton: { borderColor: p.danger },
    dangerButtonText: { color: p.danger },
    addButton: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: p.inputBorder, borderRadius: radius.field },
    addButtonText: { color: p.accent, fontSize: 15, fontWeight: '600' },
    
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: p.muted },
    input: { minHeight: 48, borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: p.text },
    saveButton: { marginTop: 4, paddingVertical: 12, alignItems: 'center', backgroundColor: p.accent, borderRadius: radius.field },
    saveButtonText: { color: p.onAccent, fontSize: 15, fontWeight: '600' },
    
    themeOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    themeOption: { flex: 1, minWidth: 80, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field },
    themeOptionSelected: { borderColor: p.accent, borderWidth: 2, backgroundColor: p.accentBackground },
    themeOptionText: { fontSize: 14, fontWeight: '600', color: p.text },
    themeOptionTextSelected: { color: p.accent },
    themeOptionDesc: { fontSize: 11, color: p.muted, marginTop: 2 },
    themeOptionDescSelected: { color: p.accent },
    
    dangerButtonFull: { marginTop: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: p.danger, borderRadius: radius.field },
    dangerButtonFullText: { color: p.danger, fontSize: 15, fontWeight: '600' },
    
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: p.background, borderRadius: radius.field, padding: 24, width: '100%', maxWidth: 400, gap: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: p.text },
    modalText: { fontSize: 14, color: p.text, lineHeight: 20 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field },
    modalCancelText: { color: p.text, fontSize: 15, fontWeight: '600' },
    modalConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: p.danger, borderRadius: radius.field },
    modalConfirmText: { color: p.onAccent, fontSize: 15, fontWeight: '600' },
  });