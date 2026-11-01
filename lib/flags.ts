/** Feature flags — disabled by default in production. */
export function adminToggleEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ALLOW_ADMIN_TOGGLE === "1";
}
export function demoSeedEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.SEED_DEMO_DATA === "1";
}
