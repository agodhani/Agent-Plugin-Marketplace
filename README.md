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
- **Playbooks** — bundle catalog items into named sets with a single `amp playbook install <slug>` command; create/edit/delete, quick-add from any plugin page
- **Install tray** — collect plugins while browsing, then generate one install command per target (AgentHub CLI, Claude Code `mcp.json`, Cursor, raw zips) — or save the tray straight into a playbook
- **Auth** — register/login; profile page has an admin toggle for testing
- **Governance pipeline** — submit → validation scan (manifest, README, archive hygiene) → security scan (exec/network/secrets/fs rules) → risk score from declared permissions + findings → admin approve/reject
- **Versioning & audit** — semver versions with changelogs; every submit/approve/reject/version/team-mark/download is audit-logged (per-plugin Activity tab + admin audit view)
- **Verified badges** — admins can mark vetted, officially supported plugins as Verified; the badge shows on cards, detail pages, compare and search, with a Verified filter chip on the catalog

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Data (SQLite + uploaded archives) lives in `data/` — delete it to reseed.

### Tests

```bash
npm test          # Playwright E2E suite (builds + serves on :3100 against a fresh .test-data db)
```

26 tests cover browse/search/filters, auth + admin toggle, the submit->scan->review->publish pipeline, versioning, downloads, teams, playbooks and the install tray. CI runs the same suite via `.github/workflows/e2e.yml`.

### Demo accounts

| Email | Password | Role |
|---|---|---|
| admin@acme.dev | admin123 | admin |
| alice@acme.dev | password123 | member |
| bob@acme.dev / priya@acme.dev | password123 | member |

The seed includes 8 approved catalog items and 1 pending high-risk submission so the review queue is populated.

## Install from the terminal

The AgentHub CLI is a single zero-dependency file, served at `/agenthub.mjs` (see `/cli` in the app for the full setup):

```bash
mkdir -p ~/.agenthub && curl -fsSL http://localhost:3000/agenthub.mjs -o ~/.agenthub/agenthub.mjs
alias agenthub="node ~/.agenthub/agenthub.mjs"
agenthub login --url http://localhost:3000 --token <token>   # token: Profile → Access tokens
agenthub install github-mcp --agent claude
agenthub playbook install frontend-agent-kit --agent cursor
```

Raw downloads also work with a token: `curl -fsSL -H "Authorization: Bearer $AGENTHUB_TOKEN" "$URL/api/plugins/<id>/download" -o <slug>.zip`

| `--agent` | Skills go to | MCP config |
|---|---|---|
| `claude` | `.claude/skills/<slug>` | `.mcp.json` |
| `cursor` | `.cursor/skills/<slug>` | `.cursor/mcp.json` |
| `devin` | `.devin/skills/<slug>` | `.devin/mcp_config.json` |
| `generic` (default) | `.agents/skills/<slug>` | — (snippet printed) |

MCP, plugin and documentation packages always install to `.agenthub/<slug>`.

API endpoints: `GET /api/v1/me` · `GET /api/v1/plugins/[slug]/files?v=` · `GET /api/v1/playbooks/[slug]`

## Submission pipeline

1. Upload a `.zip` (optional but recommended) + metadata (name, type, permissions, tags, docs).
2. **Validation**: archive safety (path traversal, size, file count), manifest presence/validity (`plugin.json`, `mcp.json`, `skill.json`, `package.json`), type-specific entrypoints, README check. Errors block submission; warnings go to the reviewer.
3. **Security scan**: regex-based static analysis for dangerous exec, network egress, hardcoded secrets, sensitive paths, destructive fs ops, env access, obfuscation.
4. **Risk score**: `Σ(permission weights) + Σ(finding severities)` → low / medium / high badge.
5. **Admin review**: `/admin` queue → inspect report → approve (publishes) or reject (with notes). All of it lands in the audit log.

## Environment flags

- `ALLOW_ADMIN_TOGGLE=1` — re-enable the profile admin switch in production (always on in dev).
- `SEED_DEMO_DATA=1` — seed demo data on an empty DB in production (always seeded in dev).
- `MARKETPLACE_DATA_DIR` — data directory (default `./data`), holds `marketplace.db` and `uploads/`.

## Admin access

```bash
npm run promote-admin -- alice@acme.dev
```

Grants `is_admin` and writes an `admin_granted` audit row. In production the profile toggle is disabled — use this script.

## Upload & scan limits

Defined once in `lib/scan.ts` (`LIMITS`): uploads ≤ 50 MB (route also checks `Content-Length` before reading the body), ≤ 500 files per archive, ≤ 50 MB uncompressed total, 5 s security-scan budget (exceeding it records a `scan-incomplete` finding). Binary executables and nested archives are flagged high risk; other binaries are reported once. Login rate limiting: 5 failures per email or 100 per IP in a 15-minute window.
In production, deploy behind a reverse proxy that appends `X-Forwarded-For` (the limiter reads the last entry).
