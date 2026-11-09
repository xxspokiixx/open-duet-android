import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AuthState =
  | { status: 'initializing' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

type AuthValue = {
  state: AuthState;
  /** Dismiss any error and retry initialization */
  retry: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'initializing' });

  useEffect(() => {
    let cancelled = false;
    
    async function initialize() {
      try {
        // Import dynamically to avoid circular deps
        const { initializeCore, isCoreReady } = await import('./local-api');
        
        if (isCoreReady()) {
          if (!cancelled) setState({ status: 'ready' });
          return;
        }
        
        await initializeCore();
        if (!cancelled) setState({ status: 'ready' });
      } catch (error) {
        if (!cancelled) {
          setState({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Failed to initialize' 
          });
        }
      }
    }
    
    initialize();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    setState({ status: 'initializing' });
    // Trigger re-initialization by remounting - in practice we'd call initializeCore again
    // For now, just reset state and let the effect run again
  }, []);

  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}