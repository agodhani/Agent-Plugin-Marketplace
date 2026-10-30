# AgentHub — Internal Agent Plugin Marketplace

An agent-agnostic internal marketplace for sharing **skills**, **MCP servers**, **plugins** and **documentation** across a company.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via `node:sqlite` (zero native deps — requires Node >= 22.13)
- Session-cookie auth (scrypt password hashing)
- JSZip for upload extraction; real static security scanning

## Features

- **Browse** — card grid with text search, type filter (skill/MCP/plugin/docs), tag chips, "used by team" filter, sorting
- **Detail pages** — About / README / FAQ / Versions / Activity tabs, share link, install command, per-version downloads
- **Teams** — create/join teams; mark plugins your team uses (visible on cards, detail pages and home filter)
- **Auth** — register/login; profile page has an admin toggle for testing
- **Governance pipeline** — submit → validation scan (manifest, README, archive hygiene) → security scan (exec/network/secrets/fs rules) → risk score from declared permissions + findings → admin approve/reject
- **Versioning & audit** — semver versions with changelogs; every submit/approve/reject/version/team-mark/download is audit-logged (per-plugin Activity tab + admin audit view)

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Data (SQLite + uploaded archives) lives in `data/` — delete it to reseed.

### Demo accounts

| Email | Password | Role |
|---|---|---|
| admin@acme.dev | admin123 | admin |
| alice@acme.dev | password123 | member |
| bob@acme.dev / priya@acme.dev | password123 | member |

The seed includes 8 approved catalog items and 1 pending high-risk submission so the review queue is populated.

## Submission pipeline

1. Upload a `.zip` (optional but recommended) + metadata (name, type, permissions, tags, docs).
2. **Validation**: archive safety (path traversal, size, file count), manifest presence/validity (`plugin.json`, `mcp.json`, `skill.json`, `package.json`), type-specific entrypoints, README check. Errors block submission; warnings go to the reviewer.
3. **Security scan**: regex-based static analysis for dangerous exec, network egress, hardcoded secrets, sensitive paths, destructive fs ops, env access, obfuscation.
4. **Risk score**: `Σ(permission weights) + Σ(finding severities)` → low / medium / high badge.
5. **Admin review**: `/admin` queue → inspect report → approve (publishes) or reject (with notes). All of it lands in the audit log.
