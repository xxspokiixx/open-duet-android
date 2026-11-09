import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { 
  type Thread, 
  type TurnEvent, 
  type Approval,
  describeLocalApiError,
} from './local-api';
import { attachmentProblem, MAX_ATTACHMENTS, type Attachment } from './attachments';
import { pickFiles, pickPhotos } from './pick-attachments';
import { applyEvents, emptyTranscript, type Transcript } from './transcript';
import { useApi } from './use-api';
import { createThreadRuntime, type ThreadRuntime } from '@openduet/core/runtime';

// Events are applied in small batches: opening a long conversation replays every stored event.
const FLUSH_MS = 40;

interface UseThreadResult {
  transcript: Transcript;
  thread: Thread | null;
  connection: 'live' | 'connecting' | 'reconnecting' | 'local';
  error: string | null;
  loaded: boolean;
  running: boolean;
  send: (text: string, attachmentIds?: string[]) => Promise<boolean>;
  attach: (kind: 'photo' | 'file', maxCount: number) => Promise<Attachment[]>;
  attachmentSource: (attachmentId: string) => { uri: string; headers: Record<string, string> } | undefined;
  stop: () => Promise<void>;
  answerApproval: (approvalId: string, decision: 'allow' | 'deny') => Promise<boolean>;
  pendingApprovals: Approval[];
}

export function useThread(threadId: number): UseThreadResult {
  const api = useApi();
  const [transcript, dispatch] = useReducer(applyEvents, undefined, emptyTranscript);
  const [thread, setThread] = useState<Thread | null>(null);
  const [connection, setConnection] = useState<'live' | 'connecting' | 'reconnecting' | 'local'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<ThreadRuntime | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const lastSeq = useRef(0);
  
  useEffect(() => {
    lastSeq.current = transcript.lastSeq;
  }, [transcript.lastSeq]);

  // Initialize thread runtime and load thread data
  useEffect(() => {
    let cancelled = false;
    
    async function init() {
      if (!api) return;
      
      try {
        setConnection('connecting');
        
        // Load thread info
        const threadData = await api.getThread(threadId);
        if (cancelled) return;
        if (threadData) {
          setThread(threadData);
        }
        
        // Create thread runtime
        const rt = await createThreadRuntime(threadId, {
          onEvent: (event) => {
            if (!cancelled) {
              dispatch([event]);
            }
          },
          onTurnStatusChange: (turnId, status) => {
            if (!cancelled) {
              // Update connection state based on turn status
              if (status === 'running') setConnection('live');
              else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                setConnection('local');
              }
            }
          },
          onError: (err) => {
            if (!cancelled) {
              setError(err.message);
            }
          },
          onApprovalRequested: (approval) => {
            if (!cancelled) {
              setPendingApprovals(prev => [...prev, approval]);
            }
          },
          onApprovalResolved: (approvalId, decision) => {
            if (!cancelled) {
              setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
            }
          },
        });
        
        if (cancelled) return;
        if (rt) {
          setRuntime(rt);
          setConnection('local');
        }
        
        // Load existing events for this thread
        const events = await api.listEvents(threadId, 0, 500);
        if (!cancelled && events.length > 0) {
          dispatch(events);
        }
        
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(describeLocalApiError(err));
        }
      }
    }
    
    init();
    
    return () => {
      cancelled = true;
      // Clean up runtime
      if (runtime) {
        runtime.stopTurn().catch(console.error);
      }
    };
  }, [api, threadId]);

  // Handle app state changes (reconnect when coming to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && runtime) {
        // Reload events in case we missed any
        api?.listEvents(threadId, lastSeq.current, 500).then(events => {
          if (events.length > 0) dispatch(events);
        });
      }
    });
    return () => subscription.remove();
  }, [api, threadId, runtime]);

  const send = useCallback(
    async (text: string, attachmentIds: string[] = []): Promise<boolean> => {
      if (!runtime) return false;
      try {
        setError(null);
        const result = await runtime.startTurn(text, attachmentIds);
        return result.status === 'completed';
      } catch (err) {
        setError(describeLocalApiError(err));
        return false;
      }
    },
    [runtime],
  );

  // Opens a picker and uploads what was chosen. Files that are refused are named; the rest still attach.
  const attach = useCallback(
    async (kind: 'photo' | 'file', maxCount: number): Promise<Attachment[]> => {
      if (!api) return [];
      const added: Attachment[] = [];
      const problems: string[] = [];
      try {
        const picked = await (kind === 'photo' ? pickPhotos(Math.min(maxCount, MAX_ATTACHMENTS)) : pickFiles(Math.min(maxCount, MAX_ATTACHMENTS)));
        for (const file of picked) {
          const problem = attachmentProblem(file.name, file.mime, file.size);
          if (problem) {
            problems.push(problem);
            continue;
          }
          try {
            added.push(await api.uploadAttachment(threadId, { name: file.name, mime: file.mime, bytes: await file.read() }));
          } catch (err) {
            problems.push(`${file.name}: ${describeLocalApiError(err)}`);
          }
        }
      } catch {
        problems.push('Could not open your files.');
      }
      setError(problems.length ? problems.join(' ') : null);
      return added;
    },
    [api, threadId],
  );

  const attachmentSource = useCallback((attachmentId: string) => {
    if (!api) return undefined;
    return api.attachmentSource(threadId, attachmentId);
  }, [api, threadId]);

  const stop = useCallback(async () => {
    if (!runtime) return;
    try {
      await runtime.stopTurn();
      setError(null);
    } catch (err) {
      setError(describeLocalApiError(err));
    }
  }, [runtime]);

  const answerApproval = useCallback(
    async (approvalId: string, decision: 'allow' | 'deny'): Promise<boolean> => {
      if (!runtime) return false;
      try {
        const success = await runtime.resolveApproval(approvalId, decision);
        if (success) {
          setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
        }
        setError(null);
        return success;
      } catch (err) {
        setError(describeLocalApiError(err));
        return false;
      }
    },
    [runtime],
  );

  const loaded = thread !== null && transcript.lastSeq >= (thread as any).last_seq;

  return { 
    transcript, 
    thread, 
    connection, 
    error, 
    loaded, 
    running: transcript.runningTurnId !== null, 
    send, 
    attach, 
    attachmentSource, 
    stop, 
    answerApproval,
    pendingApprovals,
  };
}