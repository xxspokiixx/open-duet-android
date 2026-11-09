import { useState } from 'react';

import { type Room, type RoomItem, type RoomApproval } from './rooms';

/** 
 * Stub implementation for rooms in standalone mode.
 * Rooms are not yet implemented in the local core.
 * Returns empty state so the UI doesn't crash.
 */
export function useRoom(roomId: number) {
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [approvals, setApprovals] = useState<RoomApproval[]>([]);
  const [connection, setConnection] = useState<'live' | 'connecting' | 'reconnecting' | 'local'>('local');
  const [error, setError] = useState<string | null>('Rooms are not available in standalone mode. This feature requires a server.');
  const [loaded, setLoaded] = useState(true);

  return { 
    room, 
    items, 
    approvals, 
    connection, 
    error, 
    loaded, 
    busy: false, 
    send: async () => false, 
    stop: async () => {}, 
    answer: async () => false 
  };
}