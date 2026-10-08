export interface ServerConfig {
  port: number;
  clientOrigins: string[];
  botDelayMs: number;
  waitingRoomTtlMs: number;
  idleRoomTtlMs: number;
  reconnectGraceMs: number;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};
const MIN = 60_000;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return {
    port: num(env.PORT, 3001),
    clientOrigins: (env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    botDelayMs: num(env.BOT_DELAY_MS, 1100),
    waitingRoomTtlMs: num(env.WAITING_ROOM_TTL_MIN, 30) * MIN,
    idleRoomTtlMs: num(env.IDLE_ROOM_TTL_MIN, 120) * MIN,
    reconnectGraceMs: num(env.RECONNECT_GRACE_MIN, 15) * MIN,
  };
}
