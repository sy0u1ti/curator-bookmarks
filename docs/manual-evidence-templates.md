# Manual Evidence Templates

Last reviewed: 2026-05-08

These templates help reviewers collect the manual Chrome Web Store submission evidence required by `docs/manual-release-evidence.md` and validated by `npm run release:manual-evidence`.

Do not place this file under `release/manual-evidence/`. It is only a template. Real evidence must use the exact release zip from `.perf-results/release-evidence.json`, desensitized fixture data and current UI screenshots.

## Screenshot Manifest

Target path: `release/manual-evidence/screenshots/manifest.md`

```markdown
# Store Screenshot Manifest

Version:
Release zip sha256:
Date:
Reviewer:
Fixture data:
Desensitized: yes

| Path | Surface | Viewport | Date | Version | Desensitized | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| release/manual-evidence/screenshots/popup-search.png | Popup local search | 1280x800 | YYYY-MM-DD | 1.4.31 | yes | Shows local search without requiring AI. |
| release/manual-evidence/screenshots/dashboard.png | Dashboard batch management | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows selected bookmarks and batch controls. |
| release/manual-evidence/screenshots/newtab.png | Newtab replacement | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows Newtab disclosure and bookmark source. |
| release/manual-evidence/screenshots/privacy.png | Privacy Center | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows external request categories. |
| release/manual-evidence/screenshots/health.png | Health or link-check workflow | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows Health CTA or availability preview. |
| release/manual-evidence/screenshots/backup.png | Backup or Recycle Bin | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows restore preview or recovery path. |
| release/manual-evidence/screenshots/ai-preview.png | AI request preview | 1440x900 | YYYY-MM-DD | 1.4.31 | yes | Shows optional AI preview without a real API key. |
```

## CWS Field Parity

Target path: `release/manual-evidence/cws-fields/cws-field-parity.md`

```markdown
# CWS Field Parity

Version:
Release zip sha256:
Date:
Reviewer:

## Required Fields

- Short description:
- Detailed description:
- Category:
- Language:
- Permissions:
- Privacy practices:
- Support link:
- Privacy policy:

## Sensitive Capability Parity

- Newtab replacement and restore path:
- bookmarks permission:
- optional host permission:
- webRequest:
- webNavigation:
- AI default-off statement:
- Jina default-off statement:
- link-check target URL request disclosure:
- remote code statement:
- telemetry statement:
- sale statement:
- ads statement:

## Cross-References

- `docs/privacy-practices-mapping.md` checked:
- `PRIVACY.md` checked:
- `docs/chrome-web-store-listing.md` checked:
- Options Privacy Center checked:
- Contradictions found:
- Owner and decision:
```

## User Research Record

Target path: `release/manual-evidence/user-research/participant-XX.md`

```markdown
# User Research Record

Participant:
Date:
Version:
Reviewer:
Fixture data:
Private data removed: yes

## Tasks

- First search within 3 minutes:
- Permission explanation comprehension:
- Newtab restore path:
- AI off switch:
- Jina off switch:
- link-check request understanding:
- AI request preview decision:

## Findings

- Finding:
- P0 follow-up:
- P1 follow-up:
- Owner:
```

## Visual Review

Target path: `release/manual-evidence/visual-review.md`

```markdown
# Visual Review

Version:
Release zip sha256:
Date:
Reviewer:
Baseline source:

| Surface | Baseline | Current screenshot | Overflow | Primary action | Danger action | Severity | Owner | Release decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Popup |  |  |  |  |  |  |  |  |
| Options |  |  |  |  |  |  |  |  |
| Dashboard |  |  |  |  |  |  |  |  |
| Newtab |  |  |  |  |  |  |  |  |
| Privacy Center |  |  |  |  |  |  |  |  |

Decision summary:
```

## Accessibility Review

Target path: `release/manual-evidence/accessibility.md`

```markdown
# Accessibility Review

Version:
Release zip sha256:
Date:
Reviewer:
Screen-reader:
Browser:

| Path | Keyboard | Screen-reader | Focus | Tab order | Escape behavior | Destructive confirmation announced | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Popup |  |  |  |  |  |  |  |
| Dashboard |  |  |  |  |  |  |  |
| Newtab |  |  |  |  |  |  |  |
| Options |  |  |  |  |  |  |  |

Blocking issues:
Owner:
Decision:
```

## High-Risk Operations

Target path: `release/manual-evidence/high-risk-operations.md`

```markdown
# High-Risk Operations Exploratory Pass

Version:
Release zip sha256:
Date:
Reviewer:
Fixture data:

| Operation | Delete | Restore | Move | Backup | AI | Partial failure | Cancel | Missing parent | Duplicate | Quota | Summary | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bookmark delete and bulk delete |  |  |  |  |  |  |  |  |  |  |  |  |
| Recycle Bin restore and clear records |  |  |  |  |  |  |  |  |  |  |  |  |
| Bookmark move and batch move |  |  |  |  |  |  |  |  |  |  |  |  |
| Backup restore modes |  |  |  |  |  |  |  |  |  |  |  |  |
| AI apply and move suggestions |  |  |  |  |  |  |  |  |  |  |  |  |

Issues:
Owner:
Decision:
```

## Platform Review

Target path: `release/manual-evidence/platform-review.md`

```markdown
# Clean Chrome Profile Platform Review

Version:
Release zip sha256:
Date:
Reviewer:
Clean Chrome profile:
Fixture data:
Elapsed reviewer path: 5-10 minutes

- Newtab replacement disclosure:
- Restore instructions from Newtab:
- Restore instructions from Options:
- Privacy Center review:
- optional host permission prompt captured:
- denied permission outcome:
- authorized link-check outcome:
- Featured Gallery default state:
- Web search disabled while local search works:
- CWS reviewer path completed:

Issues:
Owner:
Decision:
```

## Release Decision

Target path: `release/manual-evidence/release-decision.md`

```markdown
# Release Decision

Version:
Release zip path:
Release zip sha256:
release:check timestamp:
Date:
Owner:
Decision: hold

## Manual Evidence

- Screenshots:
- CWS fields:
- User research:
- Visual review:
- Accessibility:
- High-risk operations:
- Platform review:

## Exceptions

- P0 exceptions:
- P1 exceptions:
- Risk:
- Mitigation:
- Rollback plan:

Final decision: hold
```
