// Local API layer - wraps the core TypeScript module for the mobile app
// Replaces the server API with on-device core calls

import { 
  // Types
  type Agent, 
  type Thread, 
  type Turn, 
  type TurnEvent, 
  type Approval, 
  type MemoryNote, 
  type Routine, 
  type RoutineRun,
  type EngineConfig,
  type WorkspaceFile,
  type ToolCall,
  ApprovalMode,
  EngineProvider,
} from '@openduet/core/types';

// Core modules
import { 
  // Database
  getDatabase, closeDatabase,
  // Repositories
  createAgent, getAgentById, getAgentByName, listAgents, updateAgent, deleteAgent, setAgentPinned,
  createEngine, getEngine, listEngines, updateEngine, deleteEngine,
  createThread, getThreadById, listThreads, listThreadsByAgent, updateThreadTitle, archiveThread, updateThreadWorkspace, touchThread,
  createTurn, getTurnById, getLatestTurnByThread, listTurnsByThread, updateTurnStatus,
  addTurnEvent, getTurnEvents, getTurnEventsByThread, getLastEventSeq,
  createApproval, getPendingApprovalsByTurn, getApprovalById, resolveApproval, cancelPendingApprovals,
  createMemoryNote, getMemoryNoteById, listMemoryNotesByAgent, searchMemoryNotes, updateMemoryNote, deleteMemoryNote,
  createRoutine, getRoutineById, listRoutinesByAgent, listEnabledRoutines, updateRoutine, deleteRoutine,
  createRoutineRun, getRoutineRunById, listRoutineRuns, updateRoutineRunStatus,
  getSetting, setSetting, getWorkspaceRoot, setWorkspaceRoot, getDefaultEngine, setDefaultEngine, getTheme, setTheme,
  // Core runtime
  createThreadRuntime, ThreadRuntime,
  // Memory
  createMemoryManager, MemoryManager,
  // Files
  createFileManager, FileManager,
  // Routines
  createRoutineManager, RoutineManager, globalRoutineScheduler,
  // Engine registry
  engineRegistry, loadEnginesFromDatabase,
} from '@openduet/core';

// Re-export types for compatibility
export type { Agent, Thread, Turn, TurnEvent, Approval, MemoryNote, Routine, RoutineRun, EngineConfig, WorkspaceFile, ToolCall };
export { ApprovalMode, EngineProvider };

// Session state (replaces server session)
export interface LocalSession {
  status: 'ready' | 'initializing' | 'error';
  error?: string;
}

// Initialize the local core
let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeCore(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // Initialize database
      await getDatabase();
      
      // Load engines from database
      await loadEnginesFromDatabase();
      
      // Initialize global routine scheduler
      await globalRoutineScheduler.loadAll();
      
      initialized = true;
    } catch (error) {
      initialized = false;
      throw error;
    }
  })();
  
  return initPromise;
}

// Check if core is ready
export function isCoreReady(): boolean {
  return initialized;
}

// Agent API
export const agentsApi = {
  list: listAgents,
  get: getAgentById,
  getByName: getAgentByName,
  create: createAgent,
  update: updateAgent,
  delete: deleteAgent,
  setPinned: setAgentPinned,
};

// Engine API
export const enginesApi = {
  list: listEngines,
  get: getEngine,
  create: createEngine,
  update: updateEngine,
  delete: deleteEngine,
  getAdapter: engineRegistry.getAdapter.bind(engineRegistry),
  validateAll: engineRegistry.validateAll.bind(engineRegistry),
};

// Thread API
export const threadsApi = {
  list: listThreads,
  listByAgent: listThreadsByAgent,
  get: getThreadById,
  create: createThread,
  updateTitle: updateThreadTitle,
  archive: archiveThread,
  updateWorkspace: updateThreadWorkspace,
  touch: touchThread,
};

// Turn API
export const turnsApi = {
  create: createTurn,
  get: getTurnById,
  getLatestByThread: getLatestTurnByThread,
  listByThread: listTurnsByThread,
  updateStatus: updateTurnStatus,
};

// Events API
export const eventsApi = {
  add: addTurnEvent,
  getByTurn: getTurnEvents,
  getByThread: getTurnEventsByThread,
  getLastSeq: getLastEventSeq,
};

// Approvals API
export const approvalsApi = {
  create: createApproval,
  getPendingByTurn: getPendingApprovalsByTurn,
  get: getApprovalById,
  resolve: resolveApproval,
  cancelPending: cancelPendingApprovals,
};

// Memory API
export const memoryApi = {
  create: createMemoryNote,
  get: getMemoryNoteById,
  listByAgent: listMemoryNotesByAgent,
  search: searchMemoryNotes,
  update: updateMemoryNote,
  delete: deleteMemoryNote,
  createManager: createMemoryManager,
};

// Routines API
export const routinesApi = {
  create: createRoutine,
  get: getRoutineById,
  listByAgent: listRoutinesByAgent,
  listEnabled: listEnabledRoutines,
  update: updateRoutine,
  delete: deleteRoutine,
  createRun: createRoutineRun,
  getRun: getRoutineRunById,
  listRuns: listRoutineRuns,
  updateRunStatus: updateRoutineRunStatus,
  createManager: createRoutineManager,
};

// Settings API
export const settingsApi = {
  get: getSetting,
  set: setSetting,
  getWorkspaceRoot,
  setWorkspaceRoot,
  getDefaultEngine,
  setDefaultEngine,
  getTheme,
  setTheme,
};

// Thread Runtime API
export const runtimeApi = {
  createThreadRuntime,
};

// File Manager API
export const filesApi = {
  createFileManager,
};

// Global routine scheduler
export { globalRoutineScheduler };

// Compatibility layer - mimics the old server API structure
// This allows the existing hooks to work with minimal changes

export interface CompatThread {
  id: number;
  title: string | null;
  provider: string;
  model: string | null;
  session_state: string;
  agent_id?: number | null;
  workspace_path?: string | null;
  last_seq: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompatThreadDetail extends CompatThread {
  active_turn_id: number | null;
}

export interface CompatEventsPage {
  events: TurnEvent[];
  next_after: number;
  has_more: boolean;
}

export interface CompatAgent {
  id: number;
  name: string;
  title: string | null;
  description: string | null;
  provider: string;
  model: string | null;
  approval_mode: string;
  pinned: boolean;
}

export interface CompatRoom {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  members: CompatRoomMember[];
  unread_count: number;
}

export interface CompatRoomMember {
  id: number;
  name: string;
  agent_id: number | null;
}

export interface CompatApprovalRow {
  id: string;
  thread_id: number;
  turn_id: number;
  tool: string;
  kind: string;
  summary: string;
  input: Record<string, unknown>;
  status: string;
  created_at: string;
}

// Convert local types to compat types
function toCompatThread(thread: Thread, engine?: EngineConfig): CompatThread {
  return {
    id: thread.id,
    title: thread.title,
    provider: engine?.provider ?? 'local',
    model: engine?.model ?? null,
    session_state: thread.archivedAt ? 'archived' : 'active',
    agent_id: thread.agentId ?? null,
    workspace_path: thread.workspacePath,
    last_seq: 0, // Would need to query
    archived_at: thread.archivedAt,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
  };
}

function toCompatAgent(agent: Agent, engine?: EngineConfig): CompatAgent {
  return {
    id: agent.id,
    name: agent.name,
    title: agent.title,
    description: agent.description,
    provider: engine?.provider ?? 'local',
    model: engine?.model ?? null,
    approval_mode: agent.approvalMode,
    pinned: false, // Not stored yet
  };
}

// Compat API object that mimics the old createApi
export function createLocalApi() {
  return {
    session: { server: 'local', token: 'local' },
    
    listThreads: async (): Promise<CompatThread[]> => {
      const threads = await listThreads();
      const result: CompatThread[] = [];
      for (const thread of threads) {
        let engine: EngineConfig | undefined;
        if (thread.agentId) {
          const agent = await getAgentById(thread.agentId);
          if (agent) engine = await getEngine(agent.engineId);
        }
        result.push(toCompatThread(thread, engine));
      }
      return result;
    },
    
    searchConversations: async (query: string, offset = 0, limit = 20) => {
      // Would need to implement search across threads
      // For now, return empty
      return { results: [], nextOffset: offset + limit, hasMore: false };
    },
    
    createThread: async (agentId?: number): Promise<CompatThread> => {
      let workspacePath = '';
      if (agentId) {
        const agent = await getAgentById(agentId);
        if (agent) workspacePath = agent.workspacePath;
      }
      const thread = await createThread({ agentId: agentId ?? null, workspacePath });
      return toCompatThread(thread);
    },
    
    listAgents: async (): Promise<CompatAgent[]> => {
      const agents = await listAgents();
      const result: CompatAgent[] = [];
      for (const agent of agents) {
        const engine = await getEngine(agent.engineId);
        result.push(toCompatAgent(agent, engine));
      }
      return result;
    },
    
    getThread: async (id: number): Promise<CompatThreadDetail | null> => {
      const thread = await getThreadById(id);
      if (!thread) return null;
      let engine: EngineConfig | undefined;
      if (thread.agentId) {
        const agent = await getAgentById(thread.agentId);
        if (agent) engine = await getEngine(agent.engineId);
      }
      return { ...toCompatThread(thread, engine), active_turn_id: null };
    },
    
    listEvents: async (id: number, after: number, limit = 500): Promise<CompatEventsPage> => {
      const events = await getTurnEventsByThread(id, after, limit);
      return {
        events,
        next_after: events.length > 0 ? events[events.length - 1].seq : after,
        has_more: events.length === limit,
      };
    },
    
    sendTurn: async (id: number, text: string, attachmentIds: string[] = []): Promise<{ id: number }> => {
      // This will be handled by the thread runtime
      // For now, create a turn
      const turn = await createTurn({ threadId: id, promptText: text });
      return { id: turn.id };
    },
    
    uploadAttachment: async (id: number, file: { name: string; mime: string; bytes: Uint8Array }) => {
      // Handle attachment upload
      // For now, return a mock attachment
      return { id: `attach_${Date.now()}`, name: file.name, mime: file.mime, size: file.bytes.length };
    },
    
    attachmentSource: (id: number, attachmentId: string) => ({
      uri: `local://attachment/${attachmentId}`,
      headers: {},
    }),
    
    listFiles: async (id: number, path = '') => {
      const fileManager = await createFileManager();
      const result = await fileManager.listFiles(path);
      if (!result.success) throw new Error(result.error);
      return result.files || [];
    },
    
    previewFile: async (id: number, path: string) => {
      const fileManager = await createFileManager();
      const result = await fileManager.readFile(path);
      if (!result.success) throw new Error(result.error);
      return { content: result.content || '', truncated: false };
    },
    
    fileSource: (id: number, path: string, kind: 'raw' | 'download') => ({
      uri: `local://file/${encodeURIComponent(path)}?kind=${kind}`,
      headers: {},
    }),
    
    stopTurn: async (id: number) => {
      // Handled by thread runtime
      return { turn_id: 0 };
    },
    
    listRooms: async (): Promise<CompatRoom[]> => {
      // Rooms not implemented in local core yet
      return [];
    },
    
    getRoom: async (id: number): Promise<CompatRoom | null> => null,
    
    postRoomMessage: async (id: number, text: string) => ({ seq: 0 }),
    
    stopRoom: async (id: number) => {},
    
    markRoomRead: async (id: number, seq: number) => ({ seq }),
    
    listRoomApprovals: async (id: number): Promise<CompatApprovalRow[]> => [],
    
    listThreadApprovals: async (id: number): Promise<CompatApprovalRow[]> => {
      // Get latest turn for thread
      const turn = await getLatestTurnByThread(id);
      if (!turn) return [];
      const approvals = await getPendingApprovalsByTurn(turn.id);
      return approvals.map(a => ({
        id: a.id,
        thread_id: id,
        turn_id: a.turnId,
        tool: a.tool,
        kind: a.kind,
        summary: a.summary,
        input: a.input,
        status: a.status,
        created_at: a.createdAt,
      }));
    },
    
    answerApproval: async (threadId: number, approvalId: string, decision: 'allow' | 'deny') => {
      const success = await resolveApproval(approvalId, decision);
      return { status: success ? decision : 'error', decision };
    },
  };
}

export type LocalApi = ReturnType<typeof createLocalApi>;

// Error handling (compat with old ApiError)
export class LocalApiError extends Error {
  readonly status: number;
  readonly errorCode: string | null;

  constructor(status: number, errorCode: string | null, message: string) {
    super(message);
    this.name = 'LocalApiError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export function describeLocalApiError(error: unknown): string {
  if (!(error instanceof LocalApiError)) return 'Something went wrong. Try again.';
  const message = error.message;
  switch (error.status) {
    case 0:
      return 'Could not reach local core. Try restarting the app.';
    case 401:
      return 'Session invalid. Please restart the app.';
    case 403:
      return message || 'Access denied.';
    case 404:
      return message || 'Not found.';
    case 409:
      if (error.errorCode === 'turn_running') return 'An answer is already running. Wait for it, or stop it.';
      if (error.errorCode === 'approval_not_waiting') return 'That request is no longer waiting for an answer.';
      return message || 'That is not possible right now.';
    default:
      return error.status >= 500 ? 'Local core hit an error. Try again in a moment.' : message || 'Something went wrong. Try again.';
  }
}