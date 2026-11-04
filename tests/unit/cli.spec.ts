import { test, expect } from "@playwright/test";
import path from "node:path";

let safeJoin: any, targetDir: any, mcpConfigPath: any, serverEntry: any, mergeMcpConfig: any, isValidSlug: any;
test.beforeAll(async () => {
  const cli = (await import("../../public/agenthub.mjs")) as {
  safeJoin: (base: string, rel: string) => string;
  targetDir: (type: string, agent: string, root: string, slug: string) => string;
  mcpConfigPath: (agent: string, root: string) => string | null;
  serverEntry: (server: { command: string; args?: string[]; env?: string[] }, pluginDir: string, agent: string) => Record<string, unknown>;
  mergeMcpConfig: (text: string | null, name: string, entry: unknown) => string;
  isValidSlug: (s: string) => boolean;
  };
  ({ safeJoin, targetDir, mcpConfigPath, serverEntry, mergeMcpConfig, isValidSlug } = cli);
});

test("safeJoin rejects traversal, absolute, drive and backslash paths", () => {
  for (const bad of ["../x", "a/../../x", "/etc/passwd", "C:\\x", "a\\..\\x"]) {
    expect(() => safeJoin("/base", bad), bad).toThrow(/unsafe/i);
  }
  expect(safeJoin("/base", "a/b/c.txt")).toBe(path.resolve("/base", "a/b/c.txt"));
});

test("targetDir: skills per agent, everything else under .agenthub", () => {
  expect(targetDir("skill", "claude", "/r", "s")).toBe("/r/.claude/skills/s");
  expect(targetDir("skill", "cursor", "/r", "s")).toBe("/r/.cursor/skills/s");
  expect(targetDir("skill", "devin", "/r", "s")).toBe("/r/.devin/skills/s");
  expect(targetDir("skill", "generic", "/r", "s")).toBe("/r/.agents/skills/s");
  for (const t of ["mcp", "plugin", "documentation"]) {
    for (const a of ["claude", "cursor", "devin", "generic"]) {
      expect(targetDir(t, a, "/r", "s"), `${t}/${a}`).toBe("/r/.agenthub/s");
    }
  }
});

test("mcpConfigPath per agent", () => {
  expect(mcpConfigPath("claude", "/r")).toBe("/r/.mcp.json");
  expect(mcpConfigPath("cursor", "/r")).toBe("/r/.cursor/mcp.json");
  expect(mcpConfigPath("devin", "/r")).toBe("/r/.devin/mcp_config.json");
  expect(mcpConfigPath("generic", "/r")).toBeNull();
});

test("serverEntry: PLUGIN_DIR substitution + env syntax per agent", () => {
  const srv = { command: "node", args: ["${PLUGIN_DIR}/src/index.ts"], env: ["GITHUB_TOKEN", "X"] };
  const cl = serverEntry(srv, "/abs/dir", "claude") as { args: string[]; env: Record<string, string> };
  expect(cl.args[0]).toBe("/abs/dir/src/index.ts");
  expect(cl.env.GITHUB_TOKEN).toBe("${GITHUB_TOKEN}");
  const cu = serverEntry(srv, "/abs/dir", "cursor") as { env: Record<string, string> };
  expect(cu.env.GITHUB_TOKEN).toBe("${env:GITHUB_TOKEN}");
  const dv = serverEntry(srv, "/abs/dir", "devin") as { env?: unknown };
  expect(dv.env).toBeUndefined();
  const ge = serverEntry(srv, "/abs/dir", "generic") as { env?: unknown };
  expect(ge.env).toBeUndefined();
});

test("mergeMcpConfig: keeps servers/keys, replaces same name, works from null, throws on bad JSON", () => {
  const merged = mergeMcpConfig('{"mcpServers":{"mine":{"command":"x"}},"other":1}', "s", { command: "node" });
  const obj = JSON.parse(merged);
  expect(obj.mcpServers.mine).toEqual({ command: "x" });
  expect(obj.mcpServers.s).toEqual({ command: "node" });
  expect(obj.other).toBe(1);
  expect(merged.endsWith("\n")).toBe(true);

  const replaced = JSON.parse(mergeMcpConfig('{"mcpServers":{"s":{"command":"old"}}}', "s", { command: "new" }));
  expect(replaced.mcpServers.s).toEqual({ command: "new" });

  const fresh = JSON.parse(mergeMcpConfig(null, "s", { command: "n" }));
  expect(fresh.mcpServers.s).toEqual({ command: "n" });

  expect(() => mergeMcpConfig("{not json", "s", {})).toThrow();
});

test("isValidSlug", () => {
  for (const bad of ["../x", "a/b", "__proto__", "UPPER", "", "a".repeat(65)]) {
    expect(isValidSlug(bad), JSON.stringify(bad)).toBe(false);
  }
  expect(isValidSlug("github-mcp")).toBe(true);
});

test("mergeMcpConfig throws when mcpServers isn't an object", () => {
  expect(() => mergeMcpConfig('{"mcpServers":[]}', "s", {})).toThrow();
  expect(() => mergeMcpConfig('{"mcpServers":"x"}', "s", {})).toThrow();
});
