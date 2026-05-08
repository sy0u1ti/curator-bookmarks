# Manual Release Evidence

Last reviewed: 2026-05-08

This file is the release-submission checklist for evidence that cannot be produced by `npm run release:check`. The automated gate proves build, tests, performance budgets, extension smoke flows, release zip identity and remote-code scanning. It does not prove Chrome Web Store backend fields, real screenshots, user comprehension, visual review or manual accessibility coverage. Execute `docs/manual-verification-runbook.md` to collect these artifacts.

Status for the current repository state: required before Chrome Web Store submission. These items are external release prerequisites, not automatically satisfied by CI.
Use `docs/manual-evidence-templates.md` as the starting point for the files under `release/manual-evidence/`.
For a local, non-overwriting scaffold that pre-fills the current release version and zip sha when available, run:

```bash
npm run release:manual-evidence:init
```

The scaffold intentionally keeps `TODO` placeholders and a `hold` decision. `npm run release:manual-evidence` rejects placeholders, so the scaffold cannot satisfy the release gate until reviewers replace it with real evidence.

## Required Artifacts

| Area | Required evidence | Owner | Storage path or source | Required before CWS submission |
| --- | --- | --- | --- | --- |
| Store screenshots | 6-8 current UI screenshots showing Popup search, Dashboard management, Newtab replacement, Health/availability, Privacy & Permissions Center, Backup/Recycle, optional AI request preview. Add a text manifest in the same directory that records path, date, version, viewport, fixture, reviewer and that the data is desensitized. | Listing owner + QA | `release/manual-evidence/screenshots/` plus screenshot manifest or CWS asset export | Yes |
| Store backend fields | Chrome Web Store draft/export or screenshots for short description, detailed description, category, language, permissions justification, privacy practices, support link and privacy policy link. | Listing owner | CWS dashboard export/screenshots | Yes |
| Privacy practices parity | Completed CWS privacy-practices form checked against `docs/privacy-practices-mapping.md`, `PRIVACY.md`, listing copy and Options Privacy Center. | Privacy reviewer | CWS dashboard export + reviewer sign-off | Yes |
| User research | 5-8 target-user records covering first search, permission understanding, Newtab restore path, AI/Jina off switch and link-check request understanding. Include findings and P0/P1 follow-up decisions. | Product researcher | `release/manual-evidence/user-research/` | Yes |
| Visual review | Side-by-side review of latest E2E screenshots against accepted baseline for Popup, Options onboarding, Dashboard, Newtab, Privacy Center and Backup. Current E2E screenshots are smoke evidence, not visual-regression proof by themselves. | QA + design | `.e2e-results/screenshots/` plus baseline notes | Yes |
| Accessibility review | Manual keyboard and screen-reader pass for Popup search, result actions, folder pickers, modals, bulk selection, Newtab search/settings and Options navigation. | QA | `release/manual-evidence/accessibility.md` | Yes |
| High-risk operations | Manual exploratory pass for destructive or bulk operations that cannot be fully covered by Node tests: partial browser failures, interrupted runs, restore fallback behavior, duplicated restore, import cancellation and AI provider failures. | QA + engineering | `docs/high-risk-operations-safety.md` plus run notes | Yes |
| Platform review | Install on a clean Chrome profile, verify Newtab replacement disclosure, restore instructions, optional host permission prompt, denied-permission behavior and authorized link-check path, then run the CWS reviewer path in `docs/chrome-web-store-listing.md`. | Release owner | `release/manual-evidence/platform-review.md` | Yes |

## Evidence Rules

- Do not include API keys, Authorization headers, cookies, personal bookmarks, private URLs, full page bodies or unredacted audit logs in manual evidence.
- Use desensitized fixture data for screenshots and user-research notes.
- If a P0 evidence item is missing, do not submit to Chrome Web Store. Record the exception, risk, mitigation, owner and rollback plan first.
- If Chrome Web Store field labels change, update `docs/privacy-practices-mapping.md`, `docs/chrome-web-store-listing.md`, `PRIVACY.md` and this file together.

## Automated Evidence Boundary

`npm run release:check` must be run immediately before packaging a submission build. The generated `.perf-results/release-evidence.json` should reference this manual checklist, the manual verification runbook and the high-risk operation matrix, and state that manual evidence remains out-of-band. A passing automated gate is necessary but not sufficient for CWS submission.

After collecting manual artifacts under `release/manual-evidence/`, run:

```bash
npm run release:manual-evidence
```

This command is intentionally not part of `release:check` because CI cannot create real Chrome Web Store screenshots, user-research notes or manual accessibility evidence. It should fail until the external artifacts exist.
The checker expects textual metadata for screenshots, CWS fields, user-research records, visual review, accessibility, high-risk operations, platform review and release decision. The release decision must reference the current zip sha256 from `.perf-results/release-evidence.json` and state either `submit` or `hold`.
