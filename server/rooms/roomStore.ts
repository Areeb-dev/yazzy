import type { Room } from './types';

/**
 * Storage boundary for rooms. The in-memory version is synchronous; moving to Redis means
 * making these methods async and awaiting them in RoomService (the only caller).
 */
export interface RoomStore {
  get(roomCode: string): Room | undefined;
  set(room: Room): void;
  delete(roomCode: string): void;
  all(): Room[];
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();
  get = (code: string) => this.rooms.get(code);
  set = (room: Room) => void this.rooms.set(room.roomCode, room);
  delete = (code: string) => void this.rooms.delete(code);
  all = () => [...this.rooms.values()];
}
