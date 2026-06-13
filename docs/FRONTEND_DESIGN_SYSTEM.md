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

Read retry is explicit and keyboard accessible, and is offered only for network, timeout, 503, and unknown read failures. There are no hidden retries. Mutations are never automatically retried, including governed operations, conflicts, and unknown outcomes.

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

1. Contract-parsed data boundary.
2. Permission, disabled-mode, stale, and production-restriction panels.
3. Dialog, popover/menu, table, field, button, and notice primitives.
4. Legacy status migration.
5. Route loading/error/not-found adoption.
6. Accessible responsive graph/table patterns.
7. Full light/dark token migration and removal of legacy decorative gradients.
8. Component tests after the repository adopts a frontend test runner.
