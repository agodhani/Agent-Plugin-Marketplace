import path from "node:path";
import { PERMISSIONS, PLUGIN_TYPES, SEMVER } from "./utils";

export const LIMITS = {
  maxUploadBytes: 50 * 1024 * 1024,
  maxFiles: 500,
  maxUncompressedBytes: 50 * 1024 * 1024,
  scanBudgetMs: 5_000,
};

export interface ExtractedFile {
  name: string;
  size: number;
  text: string | null; // null = binary (not scanned)
  magic?: string; // hex of first 8 bytes, set for binaries
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface SecurityFinding {
  rule: string;
  severity: "low" | "medium" | "high";
  file: string;
  line: number;
  message: string;
  occurrences: number;
}

export interface ScanReport {
  validation: ValidationCheck[];
  findings: SecurityFinding[];
  counts: { low: number; medium: number; high: number };
  permissionScore: number;
  findingScore: number;
  score: number;
  level: "low" | "medium" | "high";
  ok: boolean;
  manifest: Record<string, unknown> | null;
}

export interface SubmitMeta {
  name: string;
  type: string;
  version: string;
  summary: string;
  permissions: string[];
  installCommand?: string;
}

const TEXT_LIKE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|sh|bash|zsh|ps1|json|jsonc|ya?ml|toml|md|txt|cfg|conf|ini|env|php|go|rs|java|kt|sql|html?|css|xml|csv|bat|cmd|vbs|lua|pl|pm|swift|cs|c|h|cc|cpp|hpp|m|mm|r|scala|groovy|gradle|tf|hcl|svelte|vue|astro|mdx|ipynb|properties|plist|service|lock|graphql|gql|proto|ejs|hbs|mustache|erb|psm1|psd1|fish|ksh|csh|awk)$/i;

const SNIFF_BYTES = 8_000;
const MAGIC_BYTES = 8;

/** Convert raw archive entries into scannable files, tagging binaries with their magic bytes. */
export function toExtractedFiles(entries: { name: string; data: Buffer }[]): ExtractedFile[] {
  return entries.map(({ name, data }) => {
    const head = data.subarray(0, SNIFF_BYTES);
    const isText = TEXT_LIKE_EXT.test(name) || data.subarray(0, 2).toString("latin1") === "#!" || !head.includes(0);
    if (isText) return { name, size: data.length, text: data.toString("utf8") };
    return { name, size: data.length, text: null, magic: data.subarray(0, MAGIC_BYTES).toString("hex") };
  });
}

interface Rule {
  id: string;
  severity: "low" | "medium" | "high";
  message: string;
  pattern?: RegExp;
  test?: (line: string) => boolean;
}

const FETCH_RE = /\b(?:curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b/i;
const PIPE_TO_SHELL_RE =
  /(?:\||&&|;)\s*(?:sudo\s+)?(?:bash|sh|zsh|dash|ksh|python3?|perl|ruby|node|iex|Invoke-Expression)\b/i;
const PROC_SUBST_RE = /\b(?:bash|sh|zsh)\s+<\s*\(\s*(?:curl|wget)\b/i;
const NETCAT_EXEC_RE = /\bnc(?:at)?\b.{0,20}\s-e\s/;
const remoteShell = (line: string): boolean => {
  const i = line.search(FETCH_RE);
  return (i !== -1 && PIPE_TO_SHELL_RE.test(line.slice(i))) || PROC_SUBST_RE.test(line) || NETCAT_EXEC_RE.test(line);
};

const RULES: Rule[] = [
  {
    id: "hardcoded-secret",
    severity: "high",
    message: "Possible hardcoded credential or secret",
    pattern:
      /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:api[_-]?key|secret|passwd|password|token)\b\s*[:=]\s*["'][A-Za-z0-9_\-/+.=]{12,}/i,
  },
  {
    id: "dangerous-exec",
    severity: "high",
    message: "Dynamic code or shell command execution",
    pattern:
      /\b(?:eval|execSync|execFileSync|spawnSync|os\.system|popen|subprocess\.(?:call|run|Popen|check_output|check_call)|pty\.spawn|shell_exec|proc_open|passthru|Runtime\.getRuntime\(\)\.exec|Deno\.run|Bun\.spawn|exec\.Command)\s*\(|\bnew\s+(?:Function|ProcessBuilder|Deno\.Command)\s*\(|\bInvoke-Expression\b|(?<![\w$.])(?:exec|execFile|spawn)\s*\(|\brequire\s*\(\s*["'`](?:node:)?child_process["'`]\s*\)|\b(?:from|import)\s+["'](?:node:)?child_process["']|\bimport\s*\(\s*["'`](?:node:)?child_process["'`]\s*\)|\bchild_process\s*\./,
  },
  {
    id: "sensitive-path",
    severity: "high",
    message: "Accesses sensitive filesystem locations",
    pattern: /(\.ssh\/|id_rsa|\.aws\/credentials|\/etc\/passwd|\/etc\/shadow|\.kube\/config)/i,
  },
  {
    id: "remote-shell",
    severity: "high",
    message: "Pipes remote content into a shell (download-and-execute)",
    test: remoteShell,
  },
  {
    id: "fs-destructive",
    severity: "medium",
    message: "Destructive filesystem operations",
    pattern:
      /\brm\s+-[a-z]{0,8}r|\bfs\.(?:rmSync|rm|rmdir|unlink)\s*\(|\bshutil\.rmtree|\bRemove-Item\b.{0,30}-Recurse/i,
  },
  {
    id: "fs-write",
    severity: "medium",
    message: "Writes to the filesystem",
    pattern:
      /\bfs\.(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\b|\bopen\s*\([^)\n]{0,200},\s*["'](?:w|a|x)[+bt]{0,2}["']/,
  },
  {
    id: "network-egress",
    severity: "medium",
    message: "Makes outbound network requests",
    pattern:
      /\b(?:fetch|axios|got|undici|urllib3?|requests\.(?:get|post|put|delete)|https?\.(?:get|request)|XMLHttpRequest|WebSocket|net\.connect|socket\.connect)\s*[(.]/,
  },
  {
    id: "env-access",
    severity: "low",
    message: "Reads environment variables",
    pattern: /process\.env\.[A-Z_][A-Z0-9_]*|os\.environ(\[|\.get)|\bgetenv\s*\(|System\.getenv\s*\(/,
  },
  {
    id: "obfuscation",
    severity: "medium",
    message: "Obfuscated or encoded payload",
    pattern:
      /\batob\s*\(|\bbase64\.(?:b64decode|decodebytes)\b|String\.fromCharCode\s*\(\s*(?:0x[0-9a-f]+|\d+)(?:\s*,\s*(?:0x[0-9a-f]+|\d+)){7,}|(?:\\x[0-9a-fA-F]{2}){8,}|\b__import__\s*\(/i,
  },
  {
    id: "insecure-http",
    severity: "low",
    message: "Uses insecure http:// URL",
    pattern: /http:\/\/[^\s"'`<>)]+/,
  },
];

const EXEC_EXT = /\.(?:exe|dll|so|dylib|node|wasm|bin|class|jar|pyc|pyo|o|a|msi|scr|com)$/i;
const EXEC_MAGIC = ["7f454c46", "4d5a", "feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe", "0061736d"];
const ARCHIVE_EXT = /\.(?:zip|tar|tgz|gz|bz2|xz|7z|rar|whl|egg|nupkg|vsix|crx)$/i;
const ARCHIVE_MAGIC = ["504b0304", "1f8b", "377abcaf271c", "526172211a07", "425a68", "fd377a585a00"];

const MANIFEST_NAMES = ["plugin.json", "manifest.json", "skill.json", "mcp.json", "package.json"];
const README_RE = /(^|\/)readme\.md$/i;

function findManifest(files: ExtractedFile[]): { file: ExtractedFile | null; data: Record<string, unknown> | null } {
  const candidates = files
    .filter((f) => {
      const base = path.posix.basename(f.name.replace(/\\/g, "/")).toLowerCase();
      return MANIFEST_NAMES.includes(base);
    })
    .sort((a, b) => a.name.split("/").length - b.name.split("/").length);
  for (const c of candidates) {
    if (!c.text) continue;
    try {
      return { file: c, data: JSON.parse(c.text) as Record<string, unknown> };
    } catch {
      return { file: c, data: null };
    }
  }
  return { file: null, data: null };
}

export function runValidation(files: ExtractedFile[], meta: SubmitMeta): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const push = (id: string, label: string, ok: boolean, severity: ValidationCheck["severity"], message: string) =>
    checks.push({ id, label, passed: ok, severity, message });

  // Metadata checks
  push("meta-name", "Name provided", meta.name.trim().length >= 3, "error",
    meta.name.trim().length >= 3 ? "Plugin name is set." : "A name of at least 3 characters is required.");
  push("meta-summary", "Summary provided", meta.summary.trim().length >= 10, "error",
    meta.summary.trim().length >= 10 ? "Summary is set." : "A summary of at least 10 characters is required.");
  push("meta-type", "Valid type", (PLUGIN_TYPES as readonly string[]).includes(meta.type), "error",
    (PLUGIN_TYPES as readonly string[]).includes(meta.type)
      ? `Type "${meta.type}" is supported.`
      : `Type "${meta.type}" is not one of: ${PLUGIN_TYPES.join(", ")}.`);
  push("meta-version", "Valid version", SEMVER.test(meta.version), "error",
    SEMVER.test(meta.version) ? `Version ${meta.version} follows semver.` : `Version "${meta.version}" is not semver (e.g. 1.0.0).`);
  const installOk =
    meta.installCommand === undefined ||
    meta.installCommand === "" ||
    (meta.installCommand.length <= 300 && !/[\u0000-\u001f\u007f]/.test(meta.installCommand));
  push("meta-install", "Single-line install command", installOk, "error",
    installOk ? "Install command is a single line." : "Install command must be a single line under 300 characters.");

  // Archive checks
  if (files.length === 0) {
    push("archive-present", "Files uploaded", false, "warning",
      "No archive was uploaded — nothing could be scanned. Reviewers will rely on metadata only.");
    return checks;
  }
  push("archive-present", "Files uploaded", true, "info", `${files.length} file(s) extracted from archive.`);

  const badPaths = files.filter((f) => f.name.includes("..") || f.name.startsWith("/") || /^[a-zA-Z]:/.test(f.name));
  push("archive-paths", "Safe archive paths", badPaths.length === 0, "error",
    badPaths.length === 0
      ? "No path traversal or absolute paths found."
      : `Unsafe paths detected: ${badPaths.slice(0, 3).map((f) => f.name).join(", ")}`);

  const total = files.reduce((s, f) => s + f.size, 0);
  push("archive-size", "Reasonable archive size", total <= LIMITS.maxUncompressedBytes, "info",
    total <= LIMITS.maxUncompressedBytes
      ? `${(total / 1024).toFixed(1)} KB total.`
      : `Archive is ${(total / 1048576).toFixed(1)} MB (max 50 MB).`);

  const binaryCount = files.filter((f) => f.text === null).length;
  push("archive-scannable", "Archive fully scannable", binaryCount === 0, "warning",
    binaryCount === 0
      ? "Every file in the archive is scannable text."
      : `${binaryCount} binary file(s) can't be scanned — see security findings`);

  // Manifest checks
  const { file: manifestFile, data: manifest } = findManifest(files);
  if (!manifestFile) {
    push("manifest-present", "Manifest found", false, "warning",
      "No plugin.json / mcp.json / skill.json / package.json manifest found at archive root.");
  } else if (!manifest) {
    push("manifest-present", "Manifest found", false, "error", `${manifestFile.name} exists but is not valid JSON.`);
  } else {
    push("manifest-present", "Manifest found", true, "info", `${manifestFile.name} parsed successfully.`);
    push("manifest-name", "Manifest has name", typeof manifest.name === "string" && manifest.name.length > 0, "warning",
      typeof manifest.name === "string" ? `name: "${manifest.name}"` : "Manifest is missing a name field.");
    push(
      "manifest-desc",
      "Manifest has description",
      typeof manifest.description === "string" && manifest.description.length > 0,
      "warning",
      typeof manifest.description === "string" ? "description is set." : "Manifest is missing a description field."
    );
    const srv = manifest.server as { command?: unknown; args?: unknown; env?: unknown } | undefined;
    if (srv !== undefined) {
      const serverOk =
        srv !== null &&
        typeof srv === "object" &&
        typeof srv.command === "string" &&
        srv.command.length > 0 &&
        (srv.args === undefined || (Array.isArray(srv.args) && srv.args.every((a) => typeof a === "string"))) &&
        (srv.env === undefined || (Array.isArray(srv.env) && srv.env.every((e) => typeof e === "string" && /^[A-Z_][A-Z0-9_]*$/.test(e))));
      push("manifest-server", "Valid server launch command", serverOk, "error",
        serverOk
          ? `server: ${srv.command}`
          : "server must be { command: string, args?: string[], env?: UPPER_SNAKE names }.");
    }
    if (meta.type === "mcp" && srv === undefined) {
      push("manifest-server", "MCP server launch command", false, "warning",
        "No server launch command in the manifest — the CLI will install the files but can't register the MCP server.");
    }
  }

  // Type-specific expectations
  const has = (re: RegExp) => files.some((f) => re.test(f.name.replace(/\\/g, "/")));
  const expectations: Record<string, { re: RegExp; label: string }> = {
    skill: { re: /(^|\/)skill\.(md|json)$/i, label: "SKILL.md / skill.json entrypoint" },
    mcp: { re: /(^|\/)(mcp\.json|package\.json|server\.(ts|js|py)|index\.(ts|js|py))$/i, label: "MCP server entrypoint (mcp.json, server.* or index.*)" },
    plugin: { re: /(^|\/)(plugin|manifest)\.json$/i, label: "plugin.json / manifest.json" },
    documentation: { re: /(^|\/)readme\.md$|\.mdx?$/i, label: "Markdown documentation" },
  };
  const exp = expectations[meta.type];
  if (exp) {
    push("type-entrypoint", `Expected entrypoint for ${meta.type}`, has(exp.re), "warning",
      has(exp.re) ? `${exp.label} found.` : `No ${exp.label} detected in archive.`);
  }

  push("readme", "README present", has(README_RE), "warning",
    has(README_RE) ? "README.md found." : "No README.md found — consider adding usage docs.");

  return checks;
}

const ruleMatches = (rule: Rule, line: string): boolean => {
  if (rule.test) return rule.test(line);
  rule.pattern!.lastIndex = 0;
  return rule.pattern!.test(line);
};

export function runSecurityScan(
  files: ExtractedFile[],
  opts?: { extra?: { name: string; text: string }[]; budgetMs?: number }
): { findings: SecurityFinding[]; counts: { low: number; medium: number; high: number } } {
  const findings: SecurityFinding[] = [];
  const budget = opts?.budgetMs ?? LIMITS.scanBudgetMs;
  const t0 = performance.now();
  const elapsed = () => performance.now() - t0;
  const extra: ExtractedFile[] = (opts?.extra ?? []).map((e) => ({ name: e.name, size: e.text.length, text: e.text }));
  const all = [...files, ...extra];
  let otherBinaries = 0;
  let firstOtherBinary = "";

  outer: for (let fi = 0; fi < all.length; fi++) {
    const file = all[fi];
    if (file.text === null) {
      const isExec = EXEC_EXT.test(file.name) || (!!file.magic && EXEC_MAGIC.some((m) => file.magic!.startsWith(m)));
      const isArchive = ARCHIVE_EXT.test(file.name) || (!!file.magic && ARCHIVE_MAGIC.some((m) => file.magic!.startsWith(m)));
      if (isExec) {
        findings.push({ rule: "binary-executable", severity: "high", file: file.name, line: 0, message: "Binary executable or library in archive", occurrences: 1 });
      }
      if (isArchive) {
        findings.push({ rule: "nested-archive", severity: "high", file: file.name, line: 0, message: "Nested archive in upload", occurrences: 1 });
      }
      if (!isExec && !isArchive) {
        otherBinaries++;
        if (!firstOtherBinary) firstOtherBinary = file.name;
      }
      continue;
    }
    if (elapsed() >= budget) {
      findings.push({
        rule: "scan-incomplete",
        severity: "high",
        file: file.name,
        line: 1,
        occurrences: all.length - fi,
        message: "Security scan hit its time limit — the rest of the archive wasn't scanned; review manually.",
      });
      break outer;
    }
    const lines = file.text.split("\n");
    let iter = 0;
    for (const rule of RULES) {
      let firstLine = -1;
      let occurrences = 0;
      for (let i = 0; i < lines.length; i++) {
        if (++iter % 1000 === 0 && elapsed() >= budget) {
          findings.push({
            rule: "scan-incomplete",
            severity: "high",
            file: file.name,
            line: i + 1,
            occurrences: all.length - fi,
            message: "Security scan hit its time limit — the rest of the archive wasn't scanned; review manually.",
          });
          break outer;
        }
        if (ruleMatches(rule, lines[i])) {
          occurrences++;
          if (firstLine === -1) firstLine = i + 1;
        }
      }
      if (occurrences > 0) {
        findings.push({ rule: rule.id, severity: rule.severity, file: file.name, line: firstLine, message: rule.message, occurrences });
        if (findings.length >= 200) break outer;
      }
    }
  }
  if (otherBinaries > 0) {
    findings.push({ rule: "binary-file", severity: "low", file: firstOtherBinary, line: 0, message: "Binary file(s) can't be scanned", occurrences: otherBinaries });
  }
  return summarizeFindings(findings);
}

function summarizeFindings(findings: SecurityFinding[]) {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const f of findings) counts[f.severity]++;
  return { findings, counts };
}

export function computeRisk(
  permissions: string[],
  counts: { low: number; medium: number; high: number }
): { score: number; level: "low" | "medium" | "high"; permissionScore: number; findingScore: number } {
  const permissionScore = permissions.reduce((s, p) => s + (PERMISSIONS.find((x) => x.id === p)?.weight ?? 0), 0);
  const findingScore = Math.min(counts.high * 5 + counts.medium * 3 + counts.low * 1, 15);
  const score = permissionScore + findingScore;
  const level = counts.high > 0 || score > 10 ? "high" : score > 4 ? "medium" : "low";
  return { score, level, permissionScore, findingScore };
}

export function runScans(files: ExtractedFile[], meta: SubmitMeta, opts?: { budgetMs?: number }): ScanReport {
  const validation = runValidation(files, meta);
  const extra = meta.installCommand?.trim() ? [{ name: "install command", text: meta.installCommand.trim() }] : undefined;
  const { findings, counts } = runSecurityScan(files, { extra, budgetMs: opts?.budgetMs });
  const { file: _mf, data: manifest } = findManifest(files);

  // Merge manifest-declared permissions with form-declared ones.
  const manifestPerms = Array.isArray(manifest?.permissions)
    ? (manifest!.permissions as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const allPerms = [...new Set([...meta.permissions, ...manifestPerms])];

  const { score, level, permissionScore, findingScore } = computeRisk(allPerms, counts);
  const ok = !validation.some((c) => c.severity === "error" && !c.passed);
  return { validation, findings, counts, permissionScore, findingScore, score, level, ok, manifest };
}
