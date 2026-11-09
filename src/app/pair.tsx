import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { KeyboardScreen } from '@/components/keyboard-screen';
import { Text, TextInput } from '@/components/text';
import { useAuth } from '@/lib/auth-context';
import { radius, touch, useStyles, useTheme, type Palette } from '@/lib/theme';

const FEATURES = [
  { icon: '🤖', title: 'AI Agents', desc: 'Create named agents with custom instructions, models, and approval modes' },
  { icon: '💬', title: 'Conversations', desc: 'Persistent chat with streaming, markdown, and file attachments' },
  { icon: '🔧', title: 'Tools', desc: 'Agents can read/write files, search the web, and execute code' },
  { icon: '🧠', title: 'Memory', desc: 'Agents remember context across conversations with full-text search' },
  { icon: '⏰', title: 'Routines', desc: 'Schedule recurring tasks that run automatically in the background' },
  { icon: '🔒', title: 'Private & Local', desc: 'All data stays on your device. No server required.' },
];

const ENGINE_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'], needsKey: true },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'], needsKey: true },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash'], needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'meta-llama/llama-3.1-405b'], needsKey: true },
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3.1', 'codellama', 'mistral'], needsKey: false, baseUrl: 'http://localhost:11434' },
];

export default function Setup() {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  const { state, retry } = useAuth();
  const router = useRouter();
  
  const [step, setStep] = useState<'welcome' | 'engine' | 'agent' | 'workspace'>('welcome');
  const [engineProvider, setEngineProvider] = useState<string>('');
  const [engineModel, setEngineModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('');
  const [agentInstructions, setAgentInstructions] = useState<string>('');
  const [approvalMode, setApprovalMode] = useState<'ask' | 'accept_edits' | 'plan'>('ask');
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'initializing') {
    return (
      <KeyboardScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Initializing Open Duet…</Text>
        </View>
      </KeyboardScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <KeyboardScreen>
        <View style={styles.center}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </KeyboardScreen>
    );
  }

  const currentProvider = ENGINE_PROVIDERS.find(p => p.id === engineProvider);
  const needsApiKey = currentProvider?.needsKey ?? true;
  const defaultBaseUrl = currentProvider?.baseUrl ?? '';

  const canProceed = {
    welcome: true,
    engine: engineProvider && engineModel && (!needsApiKey || apiKey.trim()),
    agent: agentName.trim() && agentInstructions.trim(),
    workspace: workspacePath.trim(),
  };

  const nextStep = async () => {
    if (!canProceed[step]) return;
    
    setBusy(true);
    setError(null);
    
    try {
      const { enginesApi, agentsApi, settingsApi } = await import('@/lib/local-api');
      
      switch (step) {
        case 'welcome':
          setStep('engine');
          break;
          
        case 'engine': {
          // Create engine
          const engineId = `engine_${Date.now()}`;
          await enginesApi.create({
            id: engineId,
            name: engineProvider,
            provider: engineProvider as any,
            model: engineModel,
            apiKey: apiKey || undefined,
            baseUrl: baseUrl || undefined,
          });
          // Set as default
          await settingsApi.setDefaultEngine(engineId);
          setStep('agent');
          break;
        }
        
        case 'agent': {
          // Get default engine
          const engineId = await settingsApi.getDefaultEngine();
          if (!engineId) throw new Error('No engine configured');
          
          // Get workspace root
          let wsPath = workspacePath;
          if (!wsPath) {
            const root = await settingsApi.getWorkspaceRoot();
            wsPath = root || `${(await import('expo-file-system')).documentDirectory}workspace`;
          }
          
          // Create agent
          await agentsApi.create({
            name: agentName,
            title: 'My Assistant',
            description: 'A helpful AI assistant',
            instructions: agentInstructions,
            engineId,
            approvalMode,
            workspacePath: wsPath,
          });
          setStep('workspace');
          break;
        }
        
        case 'workspace': {
          // Save workspace root
          await settingsApi.setWorkspaceRoot(workspacePath);
          // Navigate to main app
          router.replace('/');
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const skipStep = () => {
    if (step === 'welcome') setStep('engine');
    else if (step === 'engine') setStep('agent');
    else if (step === 'agent') setStep('workspace');
    else router.replace('/');
  };

  return (
    <KeyboardScreen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Progress indicator */}
        <View style={styles.progress}>
          {['welcome', 'engine', 'agent', 'workspace'].map((s, i) => (
            <View key={s} style={styles.progressStep}>
              <View style={[
                styles.progressDot, 
                (step === s ? styles.progressDotActive : '') as any,
                (['welcome', 'engine', 'agent', 'workspace'].indexOf(step) > i ? styles.progressDotDone : '') as any
              ]} />
              <Text style={[
                styles.progressLabel,
                (step === s ? styles.progressLabelActive : '') as any
              ]}>
                {s === 'welcome' ? 'Welcome' : s === 'engine' ? 'Engine' : s === 'agent' ? 'Agent' : 'Workspace'}
              </Text>
            </View>
          ))}
        </View>

        {step === 'welcome' && (
          <View style={styles.welcome}>
            <Text style={styles.logo}>🤖</Text>
            <Text style={styles.heading}>Welcome to Open Duet</Text>
            <Text style={styles.subheading}>Your private AI workspace on Android</Text>
            
            <View style={styles.features}>
              {FEATURES.map((feature, i) => (
                <View key={feature.title} style={styles.feature}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDesc}>{feature.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            
            <Text style={styles.privacyNote}>
              All data stays on your device. No account, no server, no cloud.
            </Text>
          </View>
        )}

        {step === 'engine' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Choose your AI Engine</Text>
            <Text style={styles.stepSubheading}>
              Select a provider and model. You&apos;ll need an API key for most providers.
            </Text>
            
            <View style={styles.providerList}>
              {ENGINE_PROVIDERS.map(provider => (
                <Pressable
                  key={provider.id}
                  style={[
                    styles.providerCard,
                    engineProvider === provider.id && styles.providerCardSelected
                  ]}
                  onPress={() => {
                    setEngineProvider(provider.id);
                    setEngineModel(provider.models[0]);
                    setApiKey('');
                    setBaseUrl(provider.baseUrl || '');
                  }}
                >
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerModels}>
                    Models: {provider.models.slice(0, 2).join(', ')}
                    {provider.models.length > 2 && '…'}
                  </Text>
                  {provider.needsKey && <Text style={styles.providerNote}>Requires API key</Text>}
                  {!provider.needsKey && <Text style={styles.providerNote}>Runs locally (needs Ollama installed)</Text>}
                </Pressable>
              ))}
            </View>
            
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              value={engineModel}
              onChangeText={setEngineModel}
              placeholder="e.g., claude-3-5-sonnet-20241022"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            {needsApiKey && (
              <>
                <Text style={styles.label}>API Key</Text>
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="sk-... or your API key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </>
            )}
            
            {defaultBaseUrl && (
              <>
                <Text style={styles.label}>Base URL (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  placeholder={defaultBaseUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </>
            )}
            
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}

        {step === 'agent' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Create your first Agent</Text>
            <Text style={styles.stepSubheading}>
              Give your agent a name, role, and instructions.
            </Text>
            
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={agentName}
              onChangeText={setAgentName}
              placeholder="e.g., Senior Developer"
              autoCapitalize="words"
            />
            
            <Text style={styles.label}>Instructions</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={agentInstructions}
              onChangeText={setAgentInstructions}
              placeholder="You are a senior software engineer. Help with code reviews, architecture decisions, and debugging. Be concise and practical."
              multiline
              numberOfLines={6}
            />
            
            <Text style={styles.label}>Approval Mode</Text>
            <View style={styles.approvalOptions}>
              {(['ask', 'accept_edits', 'plan'] as const).map(mode => (
                <Pressable
                  key={mode}
                  style={[
                    styles.approvalOption,
                    approvalMode === mode && styles.approvalOptionSelected
                  ]}
                  onPress={() => setApprovalMode(mode)}
                >
                  <Text style={[
                    styles.approvalOptionText,
                    approvalMode === mode && styles.approvalOptionTextSelected
                  ]}>
                    {mode === 'ask' ? 'Ask first' : mode === 'accept_edits' ? 'Accept edits' : 'Plan only'}
                  </Text>
                  <Text style={[
                    styles.approvalOptionDesc,
                    approvalMode === mode && styles.approvalOptionDescSelected
                  ]}>
                    {mode === 'ask' ? 'Pause before every tool call' : mode === 'accept_edits' ? 'Auto-approve file reads/writes' : 'Show plans, never execute'}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}

        {step === 'workspace' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeading}>Choose Workspace Folder</Text>
            <Text style={styles.stepSubheading}>
              This is where your agent will read and write files.
            </Text>
            
            <Text style={styles.label}>Workspace Path</Text>
            <TextInput
              style={styles.input}
              value={workspacePath}
              onChangeText={setWorkspacePath}
              placeholder="/storage/emulated/0/Documents/openduet-workspace"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <Text style={styles.hint}>
              The folder will be created if it doesn&apos;t exist. You can change this later in Settings.
            </Text>
            
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}

        {/* Navigation buttons */}
        <View style={styles.navButtons}>
          {step !== 'welcome' && (
            <Pressable style={styles.backButton} onPress={() => {
              if (step === 'engine') setStep('welcome');
              else if (step === 'agent') setStep('engine');
              else if (step === 'workspace') setStep('agent');
            }}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable 
            style={[styles.nextButton, !canProceed[step] && styles.nextButtonDisabled]} 
            disabled={!canProceed[step] || busy}
            onPress={nextStep}
          >
            {busy ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.nextButtonText}>{step === 'workspace' ? 'Finish' : 'Continue'}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardScreen>
  );
}

const createStyles = (p: Palette) =>
  StyleSheet.create({
    container: { padding: 20, gap: 16, flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { fontSize: 16, color: p.text },
    errorText: { fontSize: 16, color: p.danger, textAlign: 'center', marginHorizontal: 20 },
    retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: p.accent, borderRadius: radius.field },
    retryButtonText: { color: p.onAccent, fontSize: 16, fontWeight: '600' },
    
    progress: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressStep: { alignItems: 'center', flex: 1 },
    progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.surface, borderWidth: 2, borderColor: p.inputBorder },
    progressDotActive: { backgroundColor: p.accent, borderColor: p.accent },
    progressDotDone: { backgroundColor: p.success, borderColor: p.success },
    progressLabel: { fontSize: 11, color: p.muted, marginTop: 4, textAlign: 'center' },
    progressLabelActive: { color: p.accent, fontWeight: '600' },
    
    welcome: { alignItems: 'center', gap: 16 },
    logo: { fontSize: 64 },
    heading: { fontSize: 28, fontWeight: '700', color: p.text, textAlign: 'center' },
    subheading: { fontSize: 16, color: p.muted, textAlign: 'center' },
    features: { width: '100%', gap: 12, marginTop: 8 },
    feature: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: p.surface, borderRadius: radius.field },
    featureIcon: { fontSize: 28, marginTop: 2 },
    featureText: { flex: 1 },
    featureTitle: { fontSize: 16, fontWeight: '600', color: p.text },
    featureDesc: { fontSize: 13, color: p.muted, marginTop: 2 },
    privacyNote: { fontSize: 13, color: p.success, textAlign: 'center', marginTop: 8, fontWeight: '500' },
    
    stepContent: { gap: 16 },
    stepHeading: { fontSize: 22, fontWeight: '700', color: p.text },
    stepSubheading: { fontSize: 14, color: p.muted },
    label: { fontSize: 14, fontWeight: '600', color: p.text, marginTop: 4 },
    input: { minHeight: touch.min, borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: p.text },
    textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
    hint: { fontSize: 12, color: p.muted, marginTop: -8 },
    error: { fontSize: 14, color: p.danger },
    
    providerList: { gap: 8 },
    providerCard: { padding: 12, borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field, gap: 4 },
    providerCardSelected: { borderColor: p.accent, borderWidth: 2, backgroundColor: p.accentBackground },
    providerName: { fontSize: 16, fontWeight: '600', color: p.text },
    providerModels: { fontSize: 13, color: p.muted },
    providerNote: { fontSize: 12, color: p.accent },
    
    approvalOptions: { gap: 8 },
    approvalOption: { padding: 12, borderWidth: 1, borderColor: p.inputBorder, borderRadius: radius.field, gap: 4 },
    approvalOptionSelected: { borderColor: p.accent, borderWidth: 2, backgroundColor: p.accentBackground },
    approvalOptionText: { fontSize: 15, fontWeight: '600', color: p.text },
    approvalOptionTextSelected: { color: p.accent },
    approvalOptionDesc: { fontSize: 12, color: p.muted },
    approvalOptionDescSelected: { color: p.accent },
    
    navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    backButton: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 20 },
    backButtonText: { color: p.accent, fontSize: 16, fontWeight: '600' },
    nextButton: { minHeight: touch.min, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: p.accent, borderRadius: radius.field },
    nextButtonDisabled: { opacity: 0.5 },
    nextButtonText: { color: p.onAccent, fontSize: 16, fontWeight: '600' },
  });