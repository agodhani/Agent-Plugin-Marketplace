import path from "node:path";
import { PERMISSIONS, type PluginType } from "./utils";

export interface ExtractedFile {
  name: string;
  size: number;
  text: string | null; // null = binary or too large to scan
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
}

const TEXT_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|sh|bash|zsh|ps1|json|jsonc|ya?ml|toml|md|txt|cfg|conf|ini|env|php|go|rs|java|kt|sql|html?|css|xml|csv)$/i;

const MAX_SCAN_BYTES = 512 * 1024;
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

interface Rule {
  id: string;
  severity: "low" | "medium" | "high";
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    id: "hardcoded-secret",
    severity: "high",
    pattern:
      /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(api[_-]?key|secret|passwd|password|token)\b\s*[:=]\s*["'][A-Za-z0-9_\-/+.=]{12,}/i,
    message: "Possible hardcoded credential or secret",
  },
  {
    id: "dangerous-exec",
    severity: "high",
    pattern:
      /\b(eval|execSync|spawnSync|os\.system|subprocess\.(call|run|Popen)|child_process|Runtime\.getRuntime\(\)\.exec|new Function)\s*[(\.]/,
    message: "Dynamic code or shell command execution",
  },
  {
    id: "sensitive-path",
    severity: "high",
    pattern: /(\.ssh\/|id_rsa|\.aws\/credentials|\/etc\/passwd|\/etc\/shadow|\.kube\/config)/i,
    message: "Accesses sensitive filesystem locations",
  },
  {
    id: "remote-shell",
    severity: "high",
    pattern: /\b(curl|wget)\b[^|\n]*(\||&&|;)\s*(bash|sh|zsh|python)|\b(bash|sh)\s+<\s*\(\s*(curl|wget)|nc\b.{0,20}-e\s/,
    message: "Pipes remote content into a shell (download-and-execute)",
  },
  {
    id: "fs-destructive",
    severity: "medium",
    pattern: /\brm\s+-[a-z]*r[f]?|fs\.(rmSync|rm|rmdir|unlink)\s*\(|shutil\.rmtree|Remove-Item\b.{0,30}-Recurse/i,
    message: "Destructive filesystem operations",
  },
  {
    id: "fs-write",
    severity: "medium",
    pattern: /fs\.(writeFile|writeFileSync|appendFile|createWriteStream)|open\s*\([^)]*,\s*["'](w|a|x)[+"']?/,
    message: "Writes to the filesystem",
  },
  {
    id: "network-egress",
    severity: "medium",
    pattern:
      /\b(fetch|axios|got|undici|urllib3?|requests\.(get|post|put|delete)|https?\.(get|request)|XMLHttpRequest|net\.connect|socket\.connect)\s*[(\.]/,
    message: "Makes outbound network requests",
  },
  {
    id: "env-access",
    severity: "low",
    pattern: /process\.env\.[A-Z_][A-Z0-9_]*|os\.environ(\[|\.get)|\bgetenv\s*\(|System\.getenv\s*\(/,
    message: "Reads environment variables",
  },
  {
    id: "obfuscation",
    severity: "medium",
    pattern: /\batob\s*\(|base64\.(b64decode|decodebytes)|String\.fromCharCode(\s*\([^)]*\)){3,}|(\\x[0-9a-fA-F]{2}){8,}/,
    message: "Obfuscated or encoded payload",
  },
  {
    id: "insecure-http",
    severity: "low",
    pattern: /http:\/\/[^\s"'`<>)]+/,
    message: "Uses insecure http:// URL",
  },
];

const MANIFEST_NAMES = ["plugin.json", "manifest.json", "skill.json", "mcp.json", "package.json"];
const README_RE = /(^|\/)readme\.md$/i;

export function isTextFile(name: string): boolean {
  return TEXT_EXT.test(name);
}

function rootOf(name: string): string {
  const norm = name.replace(/\\/g, "/");
  const idx = norm.indexOf("/");
  return idx === -1 ? "" : norm.slice(0, idx);
}

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
  push("meta-version", "Valid version", /^\d+\.\d+\.\d+/.test(meta.version), "warning",
    /^\d+\.\d+\.\d+/.test(meta.version) ? `Version ${meta.version} follows semver.` : `Version "${meta.version}" is not semver (e.g. 1.0.0).`);

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

  push("archive-count", "Reasonable file count", files.length <= MAX_FILES, "error",
    files.length <= MAX_FILES ? `${files.length} files.` : `Archive has ${files.length} files (max ${MAX_FILES}).`);

  const total = files.reduce((s, f) => s + f.size, 0);
  push("archive-size", "Reasonable archive size", total <= MAX_TOTAL_BYTES, "error",
    total <= MAX_TOTAL_BYTES ? `${(total / 1024).toFixed(1)} KB total.` : `Archive is ${(total / 1048576).toFixed(1)} MB (max 50 MB).`);

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

export function runSecurityScan(files: ExtractedFile[]): { findings: SecurityFinding[]; counts: { low: number; medium: number; high: number } } {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    if (file.text === null) continue;
    const lines = file.text.split("\n");
    for (const rule of RULES) {
      let firstLine = -1;
      let occurrences = 0;
      for (let i = 0; i < lines.length; i++) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(lines[i])) {
          occurrences++;
          if (firstLine === -1) firstLine = i + 1;
        }
      }
      if (occurrences > 0) {
        findings.push({ rule: rule.id, severity: rule.severity, file: file.name, line: firstLine, message: rule.message, occurrences });
        if (findings.length >= 200) return summarizeFindings(findings);
      }
    }
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
  const level = score <= 4 ? "low" : score <= 10 ? "medium" : "high";
  return { score, level, permissionScore, findingScore };
}

export function runScans(files: ExtractedFile[], meta: SubmitMeta): ScanReport {
  const validation = runValidation(files, meta);
  const { findings, counts } = runSecurityScan(files);
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
