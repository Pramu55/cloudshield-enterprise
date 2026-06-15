# CloudShield Frontend Design System Foundation

## Principles

1. Operational truth before visual optimism. Unknown, empty, stale, disabled, and failed are distinct.
2. Backend facts drive status. Components never manufacture cloud state.
3. Color supports meaning; icon and visible text carry it.
4. Secure by presentation: no raw stack traces, provider errors, credentials, or unredacted evidence.
5. Accessible by default: WCAG 2.2 AA contrast, keyboard operation, visible focus, landmarks, and reduced motion.
6. Small composable primitives before page redesigns.

## Tokens

Tokens live in `apps/frontend/app/globals.css` and support light/dark system preferences.

- Surfaces: `--color-app-background`, `--color-panel`, `--color-panel-elevated`, `--color-panel-subtle`.
- Borders: `--color-border`, `--color-border-strong`.
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`.
- Actions: `--color-accent`, `--color-accent-hover`, `--color-focus-ring`.
- Meaning: `--color-success`, `--color-warning`, `--color-danger`, `--color-information`, `--color-blocked`, `--color-stale`, `--color-drifted`, `--color-outcome-unknown`, `--color-manual-review`.
- Layers: `--color-overlay`; `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- Radius: `--radius-xs` 4px, `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 16px, `--radius-pill` fully rounded.
- Spacing: existing 4/8/12/16/20/24/32/48px variables remain canonical.
- Type: `--font-size-xs`, `sm`, `md`, `lg`, `xl`, `2xl`; system UI for prose and system monospace for identifiers.

New work must use solid surfaces. Decorative gradients are prohibited. Existing gradients are legacy inventory to remove during the visual remediation branch. Motion must be functional, brief, and disabled by `prefers-reduced-motion`.

## Semantic status registry

`apps/frontend/lib/status.ts` is the canonical typed registry. Each definition includes a stable semantic key, visible label, accessible label, icon name, CSS class, and severity intent.

Supported semantic keys: healthy, connected, validated, informational, warning, degraded, partial, stale, blocked, awaiting approval, rejected, expired, drifted, outcome unknown, manual review, failed, succeeded, disabled, archived, production restricted, and not configured.

Mappings use statuses that exist in current contracts/backend code, including account/validation, scan, monitoring health, compliance, governance approval, mutation outcome, invitation, and freshness states. Visual semantic intent and visible backend labels are separate: informational states such as queued, running, validating, requested, and ready retain their truthful labels. Unknown, blank, or malformed backend values alone render `Unknown`; they never map to healthy.

`APPROVED` renders `Approved` with informational intent, and `ACCEPTED` renders `Accepted` with informational intent. Neither is execution success. Only `SUCCEEDED`, `COMPLETED`, and `CONFIRMED_SUCCEEDED` collapse to the visible `Succeeded` execution result.

`OUTCOME_UNKNOWN` is blocked-severity, not retryable success. Copy must state that execution is unconfirmed and may have occurred; the UI must not offer an automatic mutation retry.

`MANUAL_REVIEW_REQUIRED` is blocked-severity. It requires an operator-facing evidence/reconciliation path and must not be collapsed into ordinary warning or failure.

## Components

### `StatusBadge`

Props: `status?: SemanticStatusKey`, `backendStatus?: unknown`, `label?: string`, `className?: string`. Prefer a semantic key when the UI owns the state; use `backendStatus` for API values. It renders icon plus text and an accessible status label.

### `ResourceId`

Props: `value`, optional `maxLength`, `mask`, `copyValue`, and `className`. It uses monospace, deterministic middle truncation, a full visible-value title/accessibility label, and a keyboard-operable copy button. When masking is active, the displayed masked value is copied by default. Raw copying requires an explicit `copyValue={value}` opt-in, and the accessible button label states whether the masked or complete identifier will be copied. Copying writes only to the clipboard; it performs no logging, analytics, or storage writes.

### `LoadingState`

Props: optional `message`, `skeleton`, and `className`. It exposes `aria-busy`, readable text, and an optional non-semantic skeleton. Never display invented progress percentages. Spinner motion respects reduced-motion rules.

### `ErrorState`

Props: optional safe `title`, `message`, `correlationId`, `onRetry`, `retryLabel`, `action`, and `className`. It keeps only a bounded first line and replaces credential/authorization/stack-shaped content. Correlation IDs must match the current bounded UUID contract before they are displayed or copied; invalid, empty, oversized, whitespace/control, markup-like, arbitrary, and credential-shaped values are omitted. Retry is opt-in and must only be used for safe reads or explicitly idempotent operations.

### `EmptyState`

Props: `title`, `description`, optional `action`, `icon`, and `className`. It renders no records and never substitutes sample records. Empty copy must state scope and prerequisites; it must not claim a system is secure, healthy, or compliant.

## Accessibility requirements

- One main landmark per rendered route and a skip-to-main link in the authenticated shell.
- All controls keyboard operable; no clickable `div` elements.
- Icon-only controls require an `aria-label`.
- Status always uses icon plus visible text; color is supplementary.
- Focus remains visible against light and dark surfaces.
- Critical information cannot exist only in a tooltip, toast, placeholder, or color.
- Heading levels describe page structure; reusable states use a caller-compatible heading strategy in future iterations.
- Tables require labeled headers and a responsive alternative when horizontal scrolling is insufficient.
- Animation and transition behavior must respect `prefers-reduced-motion`.

## State rules

Loading preserves context but never shows fake percentages or fake records.
Error copy is safe, actionable, and separates unauthenticated, forbidden, conflict, rate-limited, unavailable, and unknown outcomes once the API error branch lands.
Empty means a successful response with zero applicable records; it is not an API failure.
Stale requires an authoritative timestamp or freshness state. Do not infer freshness from browser time.
Disabled mode explains which capability is disabled and what remains safe/read-only.
Permission state explains the missing role/capability without exposing controls that will predictably fail.
Production restriction is a backend-provided fact. It cannot be inferred from account names, IDs, regions, or environment labels.

## API error presentation

The safe API error model lives in `apps/frontend/lib/api-error.ts`. UI code consumes fixed messages and validated metadata only. Mapping is: 401 unauthenticated/session expired; 403 forbidden; 409 conflict; 422 validation; 429 rate limited; 500/503 unavailable; transport failure network; internal timeout timeout; caller abort cancelled; all other failures unknown.

Correlation IDs are accepted only as UUID values from `x-correlation-id` or the existing JSON `correlationId` field. Invalid values are omitted. `Retry-After` accepts bounded integer seconds or an HTTP date and is capped at one hour.

Session expiry is announced and redirects once to login with only a validated dashboard pathname. The client clears in-memory CSRF and stale presentation state; it cannot read or directly delete the HTTP-only session cookie. Forbidden, conflict, rate-limit, server, timeout, and network outcomes never log the user out.

Mutations fail closed when CSRF cannot be established. CSRF retrieval has its own bounded timeout and caller cancellation, does not share an abortable promise across unrelated callers, validates the token before use, and never permits a mutation request without the header. Missing or malformed tokens use a safe unknown security-session message rather than forbidden semantics.

Successful empty API responses return `undefined`. Components and callers must not assume every successful mutation or read has a JSON body. HTTP 204/205, declared zero-length bodies, and blank successful bodies are valid completion states.

## Runtime response contracts

Generic TypeScript parameters describe expected data but do not validate network data. `fetchCloudShieldClient` accepts an optional structural Zod schema. Non-empty success bodies are parsed as `unknown`, validated with `safeParse`, and only parsed output may enter React state. Unmigrated routes may omit a schema temporarily. Empty 204/205 responses remain `undefined` and do not run body validation.

Contract failure uses kind `CONTRACT_INVALID`, title `Invalid service response`, and the fixed safe message. It never contains Zod issues, paths, internal field names, raw JSON, provider errors, stacks, credentials, or tokens. It does not clear session state or redirect. A valid UUID correlation header is retained. Explicit retry is allowed only for reads; mutations are never retried.

Frontend safety schemas refine authoritative contracts without coercion. Counts are finite non-negative integers where they represent totals. Timestamps must be existing ISO datetime values or explicitly nullable. Internal identifiers may be bounded strings to avoid runtime assertion errors from strict UUID v4 constraints, while correlation IDs must remain strict UUIDs. Unknown health, account, automation, mutation-outcome, and reconciliation enums fail validation; they never become healthy, connected, approved-as-succeeded, or succeeded. Malformed data never becomes zero, current time, sample data, or a fallback success state.

Selected response source schemas use Zod object stripping for unknown properties, and the frontend additionally returns explicit allowlisted projections for command center, monitoring health, alerts, runs, automation latest, and AWS account list/mutation results. Monitoring projections remove mapped evidence and raw error-summary objects before state. The automation latest endpoint lacks an authoritative response schema, so its frontend-only projection is intentionally narrow: identifiers use the authoritative ID schema, event descriptors are bounded non-control strings, and messages reject provider-error, stack, credential, and authorization-shaped content. AWS list and mutation schemas share item-level validation without creating synthetic list metadata. Governed evidence is not yet rendered; any future consumer must project the authoritative schema into an allowlisted view model and must never treat `providerRequestId` as a correlation ID.

High-risk route projections now also cover governance activity, compliance evidence center, AWS account detail, registry mutation validation, archive responses, and STS identity validation. Governance activity never exposes its arbitrary `metadata` record. Compliance evidence never exposes `evidenceJson`, notes, provider payloads, stacks, credentials, or unknown nested fields. Counts must be finite non-negative integers, timestamps must satisfy the authoritative ISO contract, booleans are not coerced, and unknown enums fail the entire response.

Monitoring alert detail uses the same trust boundary. The frontend projects only approved alert fields and drops `mappedEvidence` because the shared contract exposes it as arbitrary records. A valid zero-evidence alert uses neutral copy and never implies safety. Lifecycle rendering is cross-field validated: unresolved states cannot carry `resolvedAt`, while `RESOLVED` requires it.

Alert acknowledgement and resolution use the strict shared `SecurityAlertLifecycleMutationResponseSchema` for the current HTTP 200 `{ status: "ok" }` envelope. Evaluation uses the strict `EvaluateMonitoringResponseSchema` for the `{ status: "QUEUED" }` envelope. These envelopes prove mutation acceptance only; they do not confirm lifecycle state or that evaluation has started. After valid acceptance, detail performs exactly one schema-validated alert read and list performs exactly one schema-validated alerts refresh. The list/detail refresh must successfully complete before the state is treated as confirmed; valid mutation acceptance without a successful validated refresh leaves the lifecycle or evaluation state unconfirmed. Malformed non-empty 2xx mutation response becomes `CONTRACT_INVALID` and prevents confirmation. A malformed refresh response also becomes `CONTRACT_INVALID`. A blank HTTP 200 is not treated as an acceptance envelope. Generic 204/205 and blank-success handling remains central-client behavior, although these routes currently return JSON. Neither surface optimistically changes state, and mutations execute once without automatic retry.

Inventory sync and scan actions validate dedicated authoritative orchestration schemas and then use an explicit `FrontendInventorySyncResponseSchema` projection. The normal top-level outcomes are `QUEUED`, `PLANNED`, and `CONFLICT`; blocked, ready-to-queue, duplicate-active, and conflict details remain item outcomes. `QUEUED` feedback states that processing is asynchronous and completion is not confirmed. Duplicate-active and blocked outcomes use warning feedback, while HTTP 409 conflict handling remains centralized. Malformed HTTP success responses become `CONTRACT_INVALID` and do not refresh account data.

Queue-add failure normally persists a safe `FAILED` run and audit event with no provider or queue internals. If the failure-transition transaction also fails, the original `QUEUED` row may remain; the response is still fixed and safe, raw errors are not logged, and active-run deduplication prevents automatic replay. This residual edge is documented rather than claimed as reconciled. Post-enqueue confirmation failure is different: queue acceptance may already have occurred, so the run remains `QUEUED` and the same deduplication protection applies. `AwsInventoryStartResponseSchema` continues to describe only `/inventory/start`; it is not reused for `/inventory/sync`.

Approval projections preserve `requestedById`, `payloadIntegrityBound`, `expiresAt`, and status so maker-checker, payload-binding, and expiry checks remain fail closed. Plan projections preserve lifecycle, approval status/expiry, mutation outcome, reconciliation status, and bounded operator guidance. `APPROVED` alone never becomes executable; unknown outcome, manual review, and pending reconciliation continue to suppress retry and replay controls.

Read retry is explicit and keyboard accessible, and is offered only for network, timeout, 503, and unknown read failures. There are no hidden retries. Mutations are never automatically retried, including governed operations, conflicts, and unknown outcomes.

## Action restrictions

`ActionCapability` separates four restriction layers: permission, policy, environment, and runtime mode. Capability data defaults closed. A missing or unknown value never enables an action, and a role label alone is not permission authority. Backend authorization remains final for every request.

Authenticated capability authority comes from the required closed map in `CurrentUserResponseSchema`. `/api/v1/auth/me` supplies an atomic user, organization, and capability snapshot computed by the backend's existing permission resolver. Frontend projections explicitly retain only the known capability keys. A reported `true` maps to `ALLOWED`, a reported `false` maps to `DENIED`, and missing or invalid session authority maps to `UNKNOWN`/not configured. Frontend code must never reconstruct the backend role-to-permission matrix.

Role labels may still drive display badges and route visibility. That filtering is UX-only: it is not authorization, must not enable mutations, and must not be described as a security boundary. Each migrated mutation control consumes its exact capability key through `GuardedAction`, while backend `requirePermission` checks remain authoritative.

`GuardedAction` renders an enabled button only for `allowed: true`. Disabled controls use `aria-disabled`, native `disabled`, and a unique visible `aria-describedby` explanation; restriction reasons are never tooltip-only. Environment-restricted mutation actions render a note instead of an executable button. `CapabilityNotice` uses `role="note"`, fixed safe copy, and existing semantic styling. Multiple actions use React `useId`, so description IDs remain unique.

- Permission: keep the session active, explain that the current workspace capability does not allow the action, and never present session expiry.
- Policy: keep the action visible and disabled when approval, maker-checker separation, payload binding, lifecycle, fresh state, or reconciliation is required.
- Environment: render no executable production mutation control. State that production mutation is intentionally unavailable while read-only assessment, evidence, inventory, and audit remain available.
- Runtime mode: state that mutation is globally disabled in this deployment while read-only capability remains available. Never suggest a browser-side override.
- Unknown outcome/manual review: never show success, retry, or replay. Keep fixed operator guidance and read-only reconciliation evidence visible.

Raw provider errors, arbitrary backend blocked-reason strings, credentials, stacks, and authorization data are not capability explanations. Recognized authoritative states map to fixed frontend text; unknown values fail closed as unavailable.

## Sample-data honesty

Sample/demo records may render only when the response explicitly marks them as sample data. Label the containing surface and each ambiguous source. Never merge sample and real totals without separate counts. Empty operational surfaces must stay empty; marketing previews remain outside authenticated application data.

## Prohibited patterns

- Unknown values rendered as healthy/connected/succeeded.
- Raw `error.message`, stack trace, AWS/provider payload, credential-like text, or unredacted evidence.
- Automatic retries for mutations, `OUTCOME_UNKNOWN`, or manual-review outcomes.
- Decorative gradients, excessive motion, invented progress, fixed production KPIs, fake timestamps, or sample rows presented as real.
- Tooltip-only critical meaning, interactive non-controls, icon-only unlabeled buttons, and client-side role checks presented as authorization.
- New chart, animation, global-state, JSON-viewer, or data-fetching libraries without a separate approved architecture decision.

## Light and dark behavior

Semantic tokens change under `prefers-color-scheme: dark`; components consume tokens rather than fixed surface colors. Existing application CSS still contains fixed light colors, so dark support currently applies to the new foundation only. Full application theme migration is future work and must include contrast testing.

## Roadmap

1. Permission, disabled-mode, stale, and production-restriction panels.
2. Remaining route contract migration and alert-detail evidence projection.
3. Dialog, popover/menu, table, field, button, and notice primitives.
4. Legacy status migration.
5. Route loading/error/not-found adoption.
6. Accessible responsive graph/table patterns.
7. Full light/dark token migration and removal of legacy decorative gradients.
8. Component and contract tests after the repository adopts a frontend test runner.
