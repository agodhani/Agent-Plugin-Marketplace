export const PLUGIN_TYPES = ["skill", "mcp", "plugin", "documentation"] as const;
export type PluginType = (typeof PLUGIN_TYPES)[number];

export const TYPE_META: Record<PluginType, { label: string; hint: string }> = {
  skill: { label: "Skill", hint: "SKILL.md or skill.json based agent skill" },
  mcp: { label: "MCP Server", hint: "Model Context Protocol server (mcp.json)" },
  plugin: { label: "Plugin", hint: "General agent plugin (plugin.json manifest)" },
  documentation: { label: "Documentation", hint: "Guides, runbooks, reference docs" },
};

export const PERMISSIONS = [
  { id: "read:files", label: "Read files", weight: 1 },
  { id: "write:files", label: "Write / modify files", weight: 3 },
  { id: "network", label: "Network access", weight: 3 },
  { id: "env", label: "Read environment variables", weight: 2 },
  { id: "secrets", label: "Access secrets / keys", weight: 4 },
  { id: "execute", label: "Execute shell commands", weight: 5 },
] as const;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function now(): string {
  return new Date().toISOString();
}

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}
