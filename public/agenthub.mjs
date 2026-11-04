#!/usr/bin/env node
// AgentHub CLI — install catalog items for your agent. Zero dependencies, Node 22+.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const VERSION = "0.1.0";

const AGENT_DIRS = {
  claude: ".claude/skills",
  cursor: ".cursor/skills",
  devin: ".devin/skills",
  generic: ".agents/skills",
};
const MCP_FILES = {
  claude: ".mcp.json",
  cursor: ".cursor/mcp.json",
  devin: ".devin/mcp_config.json",
};

export function isValidSlug(s) {
  return typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(s);
}

export function safeJoin(base, rel) {
  if (typeof rel !== "string" || rel.length === 0) throw new Error(`Unsafe path: ${rel}`);
  if (path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.includes("\\")) {
    throw new Error(`Unsafe path: ${rel}`);
  }
  const out = path.resolve(base, rel);
  const baseAbs = path.resolve(base);
  if (out !== baseAbs && !out.startsWith(baseAbs + path.sep)) throw new Error(`Unsafe path: ${rel}`);
  return out;
}

export function targetDir(type, agent, root, slug) {
  if (type === "skill") return path.join(root, AGENT_DIRS[agent] ?? AGENT_DIRS.generic, slug);
  return path.join(root, ".agenthub", slug);
}

export function mcpConfigPath(agent, root) {
  const f = MCP_FILES[agent];
  return f ? path.join(root, f) : null;
}

export function serverEntry(server, pluginDir, agent) {
  const entry = { command: server.command };
  if (Array.isArray(server.args)) {
    entry.args = server.args.map((a) => String(a).replaceAll("${PLUGIN_DIR}", pluginDir));
  }
  if (agent === "claude" && Array.isArray(server.env) && server.env.length) {
    entry.env = Object.fromEntries(server.env.map((k) => [k, `\${${k}}`]));
  } else if (agent === "cursor" && Array.isArray(server.env) && server.env.length) {
    entry.env = Object.fromEntries(server.env.map((k) => [k, `\${env:${k}}`]));
  }
  return entry;
}

export function mergeMcpConfig(text, name, entry) {
  let cfg = {};
  if (text != null && text.trim() !== "") {
    cfg = JSON.parse(text); // throws on invalid JSON — caller surfaces the error and writes nothing
    if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("config root must be an object");
  }
  if (cfg.mcpServers !== undefined && (cfg.mcpServers === null || typeof cfg.mcpServers !== "object" || Array.isArray(cfg.mcpServers))) {
    throw new Error("mcpServers must be an object");
  }
  cfg.mcpServers = { ...(cfg.mcpServers ?? {}), [name]: entry };
  return JSON.stringify(cfg, null, 2) + "\n";
}

// ---------- config ----------
function configPath() {
  return process.env.AGENTHUB_CONFIG || path.join(os.homedir(), ".config", "agenthub", "config.json");
}
function loadConfig() {
  const cfg = { url: null, token: null };
  try {
    const raw = JSON.parse(readFileSync(configPath(), "utf8"));
    cfg.url = raw.url ?? null;
    cfg.token = raw.token ?? null;
  } catch {}
  if (process.env.AGENTHUB_URL) cfg.url = process.env.AGENTHUB_URL;
  if (process.env.AGENTHUB_TOKEN) cfg.token = process.env.AGENTHUB_TOKEN;
  return cfg;
}
function saveConfig(cfg) {
  const f = configPath();
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  chmodSync(f, 0o600);
}
function die(msg, code = 1) {
  console.error(`agenthub: ${msg}`);
  process.exit(code);
}
async function api(cfg, p, { auth = true } = {}) {
  const url = `${cfg.url}${p}`;
  let res;
  try {
    res = await fetch(url, { ...(auth && cfg.token ? { headers: { Authorization: `Bearer ${cfg.token}` } } : {}), signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error(`Request to ${cfg.url} timed out`);
    throw new Error(`Network error reaching ${cfg.url}: ${e.message}`);
  }
  if (res.status === 401) throw new Error("401 Unauthorized — your token is missing or revoked. Run `agenthub login` again.");
  if (res.status === 404) throw new Error(`404 Not found: ${p}`);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}
function requireConfig(cfg) {
  if (!cfg.url || !cfg.token) die("no config — run `agenthub login --url <url> --token <token>` first");
}

// ---------- install ----------
function recordInstall(root, entry) {
  const f = path.join(root, ".agenthub", "installed.json");
  let list = [];
  try { list = JSON.parse(readFileSync(f, "utf8")); } catch {}
  list = list.filter((x) => !(x.slug === entry.slug && x.agent === entry.agent && x.dir === entry.dir));
  list.push(entry);
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(list, null, 2) + "\n");
}

async function installOne(cfg, slug, { agent, root, force }) {
  if (!isValidSlug(slug)) return { slug, error: `invalid slug: ${slug}` };
  let data;
  try {
    data = await api(cfg, `/api/v1/plugins/${encodeURIComponent(slug)}/files`);
  } catch (e) {
    return { slug, error: e.message };
  }
  const dir = targetDir(data.type, agent, root, slug);
  if (existsSync(dir)) {
    const marker = path.join(dir, ".agenthub.json");
    if (!existsSync(marker) && !force) {
      return { slug, error: `${dir} exists and wasn't installed by agenthub — pass --force to replace it` };
    }
    rmSync(dir, { recursive: true, force: true });
  }
  try {
    for (const f of data.files) {
      const dest = safeJoin(dir, f.path);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(f.base64, "base64"));
    }
  } catch (e) {
    return { slug, error: `unsafe archive: ${e.message}` };
  }
  writeFileSync(
    path.join(dir, ".agenthub.json"),
    JSON.stringify({ slug, version: data.version, type: data.type, agent, installedAt: new Date().toISOString() }, null, 2) + "\n"
  );
  recordInstall(root, { slug, version: data.version, type: data.type, agent, dir: path.relative(root, dir) });
  const notes = [];
  if (data.type === "skill") {
    const hasSkillMd = data.files.some((f) => /^SKILL\.md$/i.test(f.path.replace(/\\/g, "/")));
    if (!hasSkillMd) notes.push("warning: no root SKILL.md — the skill may not load");
  }
  if (data.type === "mcp") {
    const cfgPath = mcpConfigPath(agent, root);
    if (data.server && cfgPath) {
      const entry = serverEntry(data.server, dir, agent);
      let text = null;
      try { text = readFileSync(cfgPath, "utf8"); } catch {}
      try {
        const merged = mergeMcpConfig(text, slug, entry);
        mkdirSync(path.dirname(cfgPath), { recursive: true });
        writeFileSync(cfgPath, merged);
        notes.push(`registered in ${path.relative(root, cfgPath)}`);
      } catch (e) {
        return { slug, error: `${path.relative(root, cfgPath)} isn't valid JSON — fix or remove it (${e.message})` };
      }
      if (agent === "devin" && Array.isArray(data.server.env) && data.server.env.length) {
        notes.push(`add these env vars to .devin/mcp_config.json yourself: ${data.server.env.join(", ")}`);
      }
    } else if (data.server && !cfgPath) {
      notes.push(`no MCP config for --agent generic — add this yourself:\n${JSON.stringify({ mcpServers: { [slug]: serverEntry(data.server, dir, agent) } }, null, 2)}`);
    } else {
      notes.push("no server launch command in the manifest — files installed, but the MCP server wasn't registered");
    }
  }
  return { slug, dir: path.relative(root, dir) || dir, version: data.version, notes };
}

async function cmdInstall(cfg, slugs, opts) {
  if (!slugs.length) die("usage: agenthub install <slug...> [--agent generic|claude|cursor|devin] [--dir <path>] [--force]");
  requireConfig(cfg);
  const root = path.resolve(opts.dir || process.cwd());
  let failed = 0;
  for (const slug of slugs) {
    const r = await installOne(cfg, slug, { agent: opts.agent, root, force: opts.force });
    if (r.error) {
      failed++;
      console.error(`✗ ${slug}: ${r.error}`);
    } else {
      console.log(`✓ ${slug}@${r.version} → ${r.dir}`);
      for (const n of r.notes ?? []) console.log(`  ${n}`);
    }
  }
  if (failed) process.exit(1);
}

async function cmdPlaybookInstall(cfg, slug, opts) {
  const pb = await api(cfg, `/api/v1/playbooks/${encodeURIComponent(slug)}`, { auth: false }).catch((e) => die(e.message));
  console.log(`${pb.name}: ${pb.items.length} item${pb.items.length === 1 ? "" : "s"}`);
  await cmdInstall(cfg, pb.items.map((i) => i.slug), opts);
}

// ---------- main ----------
function parseFlags(argv, known) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") opts.force = true;
    else if (["--agent", "--dir", "--url", "--token"].includes(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) die(`missing value for ${a}`);
      opts[a.slice(2)] = v;
    } else rest.push(a);
  }
  return { opts, rest };
}

const HELP = `agenthub — AgentHub CLI ${VERSION}

usage:
  agenthub login --url <url> --token <token>
  agenthub logout
  agenthub whoami
  agenthub search <query>
  agenthub install <slug...> [--agent generic|claude|cursor|devin] [--dir <path>] [--force]
  agenthub playbook install <slug> [same flags]

config: ~/.config/agenthub/config.json (or AGENTHUB_CONFIG); AGENTHUB_URL / AGENTHUB_TOKEN override it.
`;

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const cfg = loadConfig();
  if (cmd === "--help" || cmd === "-h" || cmd === "help" || !cmd) {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "login") {
    const { opts } = parseFlags(rest);
    const url = (opts.url || cfg.url || "").replace(/\/+$/, "");
    const token = opts.token || cfg.token;
    if (!url || !token) die("usage: agenthub login --url <url> --token <token>");
    if (url.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/|$)/.test(url)) {
      console.error("warning: your token will be sent unencrypted");
    }
    const me = await api({ url, token }, "/api/v1/me").catch((e) => die(e.message));
    saveConfig({ url, token });
    console.log(`logged in as ${me.name} <${me.email}> — config saved to ${configPath()}`);
    return;
  }
  if (cmd === "logout") {
    try { rmSync(configPath(), { force: true }); } catch {}
    console.log("logged out");
    return;
  }
  if (cmd === "whoami") {
    requireConfig(cfg);
    const me = await api(cfg, "/api/v1/me").catch((e) => die(e.message));
    console.log(`${me.name} <${me.email}>`);
    return;
  }
  if (cmd === "search") {
    const q = rest.join(" ").toLowerCase();
    const idx = await api(cfg, "/api/search-index", { auth: false }).catch((e) => die(e.message));
    const hits = (idx.plugins ?? []).filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.summary ?? "").toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
    for (const p of hits) console.log(`${p.verified ? "✓ " : "  "}${p.slug}\t${p.type}\t${p.name}`);
    return;
  }
  if (cmd === "install") {
    const { opts, rest: slugs } = parseFlags(rest);
    opts.agent = opts.agent || "generic";
    if (!["generic", "claude", "cursor", "devin"].includes(opts.agent)) die(`unknown --agent ${opts.agent}`);
    await cmdInstall(cfg, slugs, opts);
    return;
  }
  if (cmd === "playbook" && rest[0] === "install") {
    const { opts, rest: slugs } = parseFlags(rest.slice(1));
    opts.agent = opts.agent || "generic";
    if (!["generic", "claude", "cursor", "devin"].includes(opts.agent)) die(`unknown --agent ${opts.agent}`);
    if (!slugs[0]) die("usage: agenthub playbook install <slug>");
    await cmdPlaybookInstall(cfg, slugs[0], opts);
    return;
  }
  die(`unknown command: ${cmd} (try --help)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => die(e.message));
}
