import { useMemo, useEffect, useState } from 'react';

import { initializeCore, createLocalApi, type LocalApi, isCoreReady } from './local-api';

/** The local API for on-device core, or null while core is initializing. */
export function useApi(): LocalApi | null {
  const [ready, setReady] = useState(isCoreReady());
  
  useEffect(() => {
    if (!ready) {
      initializeCore().then(() => setReady(true)).catch(console.error);
    }
  }, [ready]);
  
  return useMemo(() => (ready ? createLocalApi() : null), [ready]);
}

export function useCoreReady(): boolean {
  const [ready, setReady] = useState(isCoreReady());
  
  useEffect(() => {
    if (!ready) {
      initializeCore().then(() => setReady(true)).catch(console.error);
    }
  }, [ready]);
  
  return ready;
}