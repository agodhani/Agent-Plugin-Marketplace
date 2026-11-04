import { test, expect } from "@playwright/test";
import { hashPassword, hashPasswordSync, verifyPassword } from "../../lib/password";

test("async hash/verify round-trips", async () => {
  const h = await hashPassword("hunter2!");
  expect(await verifyPassword("hunter2!", h)).toBe(true);
});

test("hashPasswordSync hash verifies with async verifyPassword", async () => {
  const h = hashPasswordSync("sekret");
  expect(await verifyPassword("sekret", h)).toBe(true);
});

test("wrong password is false", async () => {
  const h = await hashPassword("right");
  expect(await verifyPassword("wrong", h)).toBe(false);
});
