# LMS Engineering Workflow

## Regression Safety Before Fixing Bugs

Before changing code for any bug or regression:

1. Search `docs/error-fixing/index.md` and the monthly files under `docs/error-fixing/` using feature names, routes, table names, and visible error text.
2. Read every related entry, especially the root cause, touched files, regression risks, and verification notes.
3. Inspect current code and existing uncommitted changes before editing. Never overwrite or revert unrelated user work.
4. Preserve documented invariants unless the current task explicitly changes the product requirement.
5. After a verified fix, append a new entry to the current monthly log and add it to `docs/error-fixing/index.md`. Do not rewrite old entries.

Use the report reference (for example `BUG-A1B2C3D4`) when the fix originated from `issue_reports`.

## Error Log Entry Requirements

Each entry must include:

- date and report reference when available;
- symptom and affected role/page;
- root cause based on evidence;
- files, routes, tables, and environment settings changed;
- implementation summary and invariants preserved;
- regression risks;
- exact verification performed and deployment result.

Do not record passwords, API keys, tokens, phone numbers belonging to users, or sensitive report contents in Markdown.
