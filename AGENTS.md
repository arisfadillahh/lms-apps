# LMS Clevio Engineering Handbook

This file is the default operating context for coding agents working in this repository. Read it before making changes. The user may give short instructions in Indonesian; infer the requested implementation from the current product and code, then complete the work end to end unless the user explicitly asks to inspect only, explain first, or avoid changes.

## Product And Communication

- This repository contains the Clevio LMS used by Admin, Coach, Coder, and parents.
- Reply in concise Indonesian unless the user uses another language.
- Treat the newest instruction as authoritative. Preserve every compatible requirement from the current task.
- For implementation requests, continue through investigation, code, verification, deployment when access is available, and a clear result summary. Do not stop at a proposal.
- If the user says `cek dulu`, `jangan ubah`, or asks why something happens, investigate and report without modifying code or data.
- Never claim a fix is complete merely because code was written. State exactly what was tested, deployed, or still requires authenticated/device verification.

## Repository Orientation

- Framework: Next.js App Router with TypeScript.
- Main application source: `src/app`, `src/components`, and `src/lib`.
- Role route groups live under folders such as `src/app/(admin)`, `src/app/(coach)`, and `src/app/(coder)`.
- Server endpoints live under `src/app/api`.
- Database access uses Supabase. Schema changes belong in versioned migration files and must be compatible with existing production data.
- Focused regression and contract tests live in `src/lib/__tests__`.
- Shared application styling is in `src/app/globals.css`; reuse existing components and design tokens before introducing new patterns.
- Runtime configuration belongs in environment variables. Never commit `.env` files, credentials, tokens, private keys, WhatsApp sessions, uploads, backups, or production data.
- `event-manager/`, when present in a checkout, is a separate nested working repository. Do not stage it as an LMS submodule or remove its `.git` directory unless the user explicitly defines how that repository should be published.

## Start Every Task

1. Run `git status --short` and inspect relevant diffs. The worktree may contain user changes; never revert, overwrite, or reformat unrelated work.
2. Search `docs/error-fixing/index.md` and the monthly files in `docs/error-fixing/` using feature names, routes, tables, visible errors, and report references.
3. Read every related entry, especially root cause, touched files, invariants, regression risks, and verification notes.
4. Inspect the current implementation, adjacent role views, APIs, tests, and migrations before deciding the fix.
5. For production-only behavior, compare local and deployed source/config when access is available. Do not expose secrets in output or documentation.
6. Make the smallest coherent change that fixes the root cause and keeps established product behavior intact.

Use the issue report reference, for example `BUG-A1B2C3D4`, when the task originated from `issue_reports`.

## Engineering Rules

- Fix root causes, not only visible symptoms.
- Reuse existing repository patterns, shared components, validation schemas, and API helpers.
- Keep global templates separate from class-specific/runtime copies. A change requested for one class must not mutate another class or a global lesson template unless explicitly required.
- Preserve immutable record IDs when editing. Display order and titles are not safe identifiers.
- When a list item opens a manager page in the established Weekly flow, preserve the list-page to detail-page separation for parallel Ekskul flows unless the user requests otherwise.
- Data mutations must be scoped by ownership identifiers such as plan, class, lesson, enrollment, or user ID. Validate those relationships server-side.
- Never delete, reset, bulk-update, send real messages, trigger payments, or create operational records merely to test a UI. Use non-mutating probes, contract tests, or an explicitly approved test record.
- Database migrations must be additive or explicitly data-safe. Review indexes, constraints, RLS, defaults, and compatibility with existing rows.
- Keep responsive behavior complete on desktop and mobile. Controls must remain reachable in short viewports and modals; avoid horizontal overflow for primary workflows.
- Maintain accessibility for dialogs, labels, keyboard actions, disabled states, and icon-only buttons.
- Do not add sensitive user data, phone numbers, credentials, message contents, or production payloads to Markdown logs or fixtures.

## Regression Safety Before Fixing Bugs

Before changing code for any bug or regression:

1. Search the error log as described above.
2. Confirm the current root cause with code, schema, logs, or a reproducible behavior.
3. Identify invariants that previous fixes protect.
4. Add or update a focused regression test whenever the behavior can be expressed deterministically.
5. After a verified fix, append a new entry to the current monthly log and add it to `docs/error-fixing/index.md`. Never rewrite historical entries to make a new change look cleaner.

## Error Log Entry Requirements

Each entry must include:

- date and report reference when available;
- symptom and affected role/page;
- root cause based on evidence;
- files, routes, tables, migrations, and environment settings changed;
- implementation summary and invariants preserved;
- regression risks;
- exact verification performed;
- deployment result and any remaining authenticated/device verification.

## Verification Standard

Scale verification to risk, but use this order by default:

1. Run focused Vitest files for the changed behavior.
2. Run `npx tsc --noEmit`.
3. Run `git diff --check`.
4. Run `npm run build` for shared, route, API, configuration, or production changes.
5. Perform route/API smoke checks. Protected routes should redirect or return `401` while signed out, not leak data.
6. For UI work, verify representative desktop and mobile viewports with the available browser tools. If authentication or browser state blocks this, report it explicitly.
7. For deployed work, confirm the process is online and inspect recent error logs after real requests.

Do not treat lint/build warnings that predate the change as new failures, but record relevant residual risk.

## Deployment And Git

- `production` is the canonical branch for deployable LMS source. Treat `dev-ver-2` as legacy history; do not merge it into `production` wholesale.
- On every device, fetch first and create a short-lived `codex/<device>-<task>` branch from `origin/production`. Never start new work from a stale local branch.
- Do not push feature or fix commits directly to `production`. Push the task branch, verify it, then let one integration owner fast-forward or merge it into `production` after checking that no newer production work is being overwritten.
- Before integrating, rebase the task branch on the latest `origin/production`, resolve conflicts against current production behavior, and rerun the required checks.
- The canonical remote is the repository's configured `origin`; do not hardcode credentials or personal access tokens in files or commands saved to the repo.
- Before pushing, fetch the remote, confirm branch divergence, review the staged diff, and scan changed files for secrets.
- Stage files explicitly when unrelated or nested repositories exist.
- Commit source, tests, migrations, `AGENTS.md`, and `docs/error-fixing` entries together when they describe one coherent completed change.
- Do not commit build output, dependency folders, local logs, screenshots used only for debugging, sessions, uploads, backups, or `.env` files.
- Do not force-push or rewrite shared branch history unless explicitly requested.
- Production deployment is separate from Git publication. A push does not prove production is updated, and a server hotfix is incomplete until the matching source is committed and pushed.
- Deploy only an exact commit already present on `origin/production`; record that SHA before and after deployment.
- After a normal implementation task is verified and integrated into `origin/production`, deploy that exact SHA to the VPS in the same task unless the user explicitly says not to deploy or asks for inspection only.
- Only one production deployment may run at a time. The deploy process must acquire the VPS lock `/var/lock/lms-production-deploy.lock` and fail closed when the lock is held.
- Never use `scp`, direct source editing, or ad hoc file replacement as the normal deployment path. Never pull, reset, or overwrite a dirty VPS checkout; stop and reconcile it against Git first.
- Follow `docs/production-workflow.md` for device handoff, integration, deployment, rollback, and the one-time VPS cutover.
- Use `/root/lms/deploy-production.sh <production-sha>` after the one-time cutover. Never report completion until the deployed SHA, PM2 status, smoke checks, and rollback target are known.

## Completion Checklist

Before reporting completion, confirm:

- the newest user request is fully addressed;
- unrelated local work remains untouched;
- relevant tests and build checks passed, or failures are explained;
- no secrets or generated/runtime data are staged;
- error-fixing documentation is current for bug work;
- deployed source matches committed source when deployment was part of the task;
- the final response names the branch/commit/push result and any remaining limitation.
