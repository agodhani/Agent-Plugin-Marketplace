// Sliding-window login rate limiter. The counting logic is pure (`now` is
// injectable for tests). Production state lives in SQLite via the injected
// store from lib/rate-limit-store, so it's shared across server processes and
// survives restarts.
export const WINDOW_MS = 15 * 60_000;
const EMAIL_MAX = 5;
const IP_MAX = 100;

export interface FailureStore {
  get(key: string): number[];
  /** Atomically append one timestamp (SQL upsert in the DB store). */
  append(key: string, ts: number): void;
  clear(key: string): void;
}

const mem = globalThis as unknown as {
  __loginFailEmail?: Map<string, number[]>;
  __loginFailIp?: Map<string, number[]>;
};
mem.__loginFailEmail ??= new Map();
mem.__loginFailIp ??= new Map();

const mapStore = (m: Map<string, number[]>): FailureStore => ({
  get: (k) => m.get(k) ?? [],
  append: (k, ts) => m.set(k, [...(m.get(k) ?? []), ts]),
  clear: (k) => void m.delete(k),
});

const defaultStores = () => ({ email: mapStore(mem.__loginFailEmail!), ip: mapStore(mem.__loginFailIp!) });

function prune(list: number[], now: number): number[] {
  return list.filter((t) => now - t < WINDOW_MS);
}

export function loginBlocked(
  email: string,
  ip: string,
  now = Date.now(),
  store = defaultStores()
): boolean {
  const e = prune(store.email.get(email), now);
  const i = prune(store.ip.get(ip), now);
  return e.length >= EMAIL_MAX || i.length >= IP_MAX;
}

export function recordLoginFailure(
  email: string,
  ip: string,
  now = Date.now(),
  store = defaultStores()
) {
  store.email.append(email, now);
  store.ip.append(ip, now);
}

export function clearLoginFailures(email: string, store: FailureStore = mapStore(mem.__loginFailEmail!)) {
  store.clear(email);
}
