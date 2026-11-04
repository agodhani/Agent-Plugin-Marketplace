import { test, expect } from "@playwright/test";
import { generateToken, hashToken } from "../../lib/tokens";

test("token format: ahp_ prefix, base64url body, ~46 chars", () => {
  const t = generateToken();
  expect(t).toMatch(/^ahp_[A-Za-z0-9_-]{43}$/);
  expect(t.length).toBe(47);
});

test("hash is sha256 hex, not the token", () => {
  const t = generateToken();
  const h = hashToken(t);
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(h).not.toBe(t);
  expect(hashToken(t)).toBe(h);
});
