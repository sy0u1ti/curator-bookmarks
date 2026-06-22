# AI Runtime Stability Refactor Notes

## Inventory

- Options batch bookmark analysis and Dashboard tag regeneration share `requestAiNamingBatch` in `src/options/options-controller.ts`.
- Popup smart classification uses `requestSmartClassification` in `src/popup/smart-classifier.ts`.
- Popup and Dashboard natural-language search use `requestNaturalSearchAiPlan` in `src/popup/natural-search-ai.ts`.
- Service worker auto analyze and Inbox classification use `requestAutoClassification` in `src/service-worker/service-worker.ts`.

## Runtime Boundary

`src/shared/ai-runtime.ts` now owns:

- Provider endpoint request construction for Responses API and Chat Completions.
- Timeout and abort-aware fetch behavior.
- Provider HTTP error extraction and retryable provider status mapping.
- Structured JSON extraction, JSON parsing, schema validation, and typed `AiRuntimeError`.
- One bounded retry for parse/schema failures and retryable network/provider failures.
- Folder candidate payloads and existing-folder `folder_id` validation.

The runtime returns data and metadata only. Privacy audit logging remains in the options domain.

## Schema Decision

Ajv is not present in the dependency tree. This refactor uses a small local JSON Schema subset validator to avoid adding production bundle and lockfile risk during the stability migration. The schemas remain the source of truth, and the validator covers the subset used by current AI outputs: object, array, string, number, integer, boolean, null, required fields, additional properties, enums, item limits, string length, and numeric ranges.

## Compatibility Notes

- `curatorBookmarkAiNamingSettings` and bookmark tag index storage keys are unchanged.
- Existing provider settings, custom system prompts, Responses API, and Chat Completions remain supported.
- Bookmark analysis keeps `suggested_folder` and adds optional `folder_decision`.
- Existing-folder decisions validate `folder_id` against the candidates sent to the model.
- New-folder paths still go through existing user-confirmed move/save flows before creating folders.
- Popup smart classification now preserves `folder_id` when the model returns existing folders.

## Verification

- `npm run test:ai` runs provider envelope, parse/schema retry, abort, and folder decision unit tests without credentials.
- `npm run eval:ai` validates anonymized local fixtures without external provider credentials.
- `npm test` runs AI runtime tests, typecheck, and build.
- `npm run smoke:extension` remains the browser smoke check when the local Chromium extension environment is available.
