import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, useColorScheme, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { FontsLoadedContext, Text, useFont } from '@/components/text';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { FONT_FILES } from '@/lib/font-assets';
import { touch, useTheme } from '@/lib/theme';

// A header link is a full-size touch target around its words, with room on the side facing the title.
function HeaderLink({ href, label, side }: { href: '/settings' | '/search'; label: string; side: 'left' | 'right' }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" hitSlop={8} style={{ minHeight: touch.min, minWidth: touch.min, justifyContent: 'center', alignItems: side === 'left' ? 'flex-start' : 'flex-end', ...(side === 'left' ? { marginRight: 16 } : {}) }}>
        {/* Header text grows with the person's text size, but only so far: the title beside it needs room. */}
        <Text maxFontSizeMultiplier={1.3} style={{ color: theme.accentText, fontWeight: '500', fontSize: 16 }}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

const SettingsLink = () => <HeaderLink href="/settings" label="Settings" side="right" />;
const SearchLink = () => <HeaderLink href="/search" label="Search" side="left" />;

function RootStack({ ready }: { ready: boolean }) {
  const { state } = useAuth();
  const theme = useTheme();
  const headerTitleStyle = useFont({ fontWeight: '600' });
  
  if (state.status === 'initializing' || !ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator />
      </View>
    );
  }
  
  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: 20 }}>
        <Text style={{ color: theme.danger, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          {state.message}
        </Text>
        <Link href="/pair" asChild>
          <Pressable style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.accent, borderRadius: 8 }}>
            <Text style={{ color: theme.onAccent, fontSize: 16, fontWeight: '600' }}>
              Retry Setup
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }
  
  // Ready state - show main app
  return (
    <Stack screenOptions={{ headerTitleStyle }}>
      <Stack.Screen name="index" options={{ title: 'Conversations', headerLeft: SearchLink, headerRight: SettingsLink }} />
      <Stack.Screen name="search" options={{ title: 'Search' }} />
      <Stack.Screen name="thread/[id]" options={{ title: 'Conversation' }} />
      <Stack.Screen name="files/[id]/index" options={{ title: 'Files' }} />
      <Stack.Screen name="files/[id]/view" options={{ title: 'File' }} />
      <Stack.Screen name="new" options={{ title: 'New conversation', presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Setup screen (shown when not initialized) */}
      <Stack.Screen name="pair" options={{ title: 'Open Duet', presentation: 'modal' }} />
    </Stack>
  );
}

// Headers, screen backgrounds and borders come from the same palette as the screens themselves.
function useNavigationTheme() {
  const theme = useTheme();
  const base = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  return { ...base, colors: { ...base.colors, background: theme.background, card: theme.background, text: theme.text, border: theme.border, primary: theme.accentText } };
}

export default function RootLayout() {
  const navigationTheme = useNavigationTheme();
  // The screens wait for the fonts; if they cannot load, the app carries on in the system font.
  const [loaded, failed] = useFonts(FONT_FILES);
  return (
    <KeyboardProvider>
      <ThemeProvider value={navigationTheme}>
        <FontsLoadedContext.Provider value={loaded}>
          <AuthProvider>
            <StatusBar style="auto" />
            <RootStack ready={loaded || failed !== null} />
          </AuthProvider>
        </FontsLoadedContext.Provider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}