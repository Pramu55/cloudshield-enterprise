# CloudShield Frontend Production Audit

Milestone: `CLOUDSHIELD_FRONTEND_AUDIT_AND_DESIGN_SYSTEM`
Audited base: `2a81529 feat: add authoritative EC2 fingerprint capture (#20)`

## Executive verdict

The frontend is a credible product shell over real organization-scoped APIs, but it is not production-ready. Authentication uses an HTTP-only session cookie and CSRF protection rather than browser-stored bearer tokens, which is a sound baseline. The primary risks are inconsistent request/error handling, pervasive unvalidated `any` responses, client-only data loading, missing route-level loading/error/not-found boundaries, incomplete permission enforcement in the UI, misleading operational copy, and raw provider-shaped evidence/error exposure.

P0 blockers are session-expiry/401 behavior, safe error normalization with correlation IDs, response validation for mutation and monitoring paths, permission enforcement for privileged actions, and removal of misleading "secure/healthy" conclusions when data is empty or unavailable.

## Scope inspected

All tracked files under `apps/frontend/app`, `apps/frontend/components`, and `apps/frontend/lib`; `apps/frontend/middleware.ts`; Next, TypeScript, PostCSS, Tailwind, and package configuration; route wrappers and dynamic routes; authentication forms; dashboard shell; search and notification components; API helpers; and existing test scripts. No frontend test framework or test files exist. No `loading.tsx`, `error.tsx`, `global-error.tsx`, or `not-found.tsx` exists.

## Route inventory

Legend for gaps: `L` loading, `E` error, `0` empty, `P` permission, `D` disabled mode, `S` stale data, `R` production restriction, `A11y`, `Resp`, `C` contract, `Sec`. A listed code means the state is missing or materially incomplete. "Client" includes server route wrappers whose rendered view is a client component.

| Route | Purpose / component | Endpoint(s) | Access / source | Classification | Gaps and evidence-based risks |
|---|---|---|---|---|---|
| `/` | Marketing landing; server page with mostly server components | None | Public; static product copy | Hardcoded marketing content, not operational data | `A11y`, `Resp`; decorative animation/gradients and inline styles; claims require product/legal review |
| `/login` | Sign in; client page/form | `POST /api/v1/auth/login`, `GET /api/v1/auth/csrf` | Public; API-backed | Wired | `E`, `S`, `Sec`; direct fetch bypass, no correlation ID, no visible session-expiry reason |
| `/register` | Workspace/invite registration; client | `POST /api/v1/auth/register`, CSRF | Public; API-backed | Wired | `E`, `C`, `Sec`; raw backend `message` can reach UI; invitation query values populate form without schema validation |
| `/invite/[token]` | Inspect and accept invitation; client | `GET /api/v1/invitations/:token`, `POST /api/v1/invitations/accept` | Public; API-backed | Wired | `E`, `C`, `Sec`; token in URL, generic errors, no route boundary |
| `/dashboard` | Command center overview; client view | `/api/v1/dashboard/command-center`, `/api/v1/security-monitoring/health` | Cookie-authenticated; API-backed | Partially wired | `L E 0 P D S R C`; `any` monitoring payload, null/zero ambiguity, inferred connector state can hide partial/failure states |
| `/dashboard/accounts` | AWS account registry and actions; client | accounts list, connector status, inventory plan, auth/me, teams; account mutations | Authenticated; API-backed | Wired with disabled-mode support | `E P S R C Sec`; client role checks only, broad mutation error strings, sample-capable contract fields |
| `/dashboard/accounts/[accountId]` | Account detail/actions; client | account detail, connector status, inventory plan, auth/me; validate/sync/archive | Authenticated; API-backed | Wired | `E P S R C Sec`; no not-found boundary; route parameter inserted without response validation |
| `/dashboard/inventory` | Resource inventory; client | `GET /api/v1/inventory/resources` | Authenticated; API-backed | Partially wired | `L E P D S R C`; empty is generic; no freshness explanation per row |
| `/dashboard/inventory/[resourceId]` | Resource detail; client | `GET /api/v1/platform/resources/:resourceId/detail` | Authenticated; API-backed | Partially wired | `L E 0 P D S R C Sec`; untyped record; no not-found; encoded path value is not explicit |
| `/dashboard/graph` | Resource relationship graph; client | `GET /api/v1/resources/graph` | Authenticated; API-backed | Placeholder/partially wired | `L E 0 P D S R C A11y Resp`; no graph accessibility model; no large-graph protection |
| `/dashboard/cost` | Cost findings; client | `GET /api/v1/findings/cost` | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; untyped response and no currency/freshness contract |
| `/dashboard/security` | Security findings; client | `GET /api/v1/findings/security` | Authenticated; API-backed | Partially wired | `L E P D S R C`; contract imported but runtime-unvalidated; empty must not imply safety |
| `/dashboard/monitoring` | Monitoring health, alerts, runs and mutations; client | health, alerts, runs, evaluate, acknowledge, resolve | Authenticated; API-backed | Wired but high risk | `E P D S R C Sec A11y Resp`; all payloads `any`; errors only logged; empty alerts says environment is secure; `alert()` and fixed mutation notes |
| `/dashboard/monitoring/alerts/[id]` | Alert evidence and lifecycle; client | alert detail, acknowledge, resolve | Authenticated; API-backed | Wired but high risk | `E P S R C Sec Resp`; raw `err.message` alert, raw evidence JSON, no schema/credential redaction, no not-found boundary |
| `/dashboard/governance` | Plans, approvals, activity; client | remediation plans, governance approvals/activity | Authenticated; API-backed | Partially wired | `L E 0 P D S R C Sec`; untyped responses; mutation outcome semantics not centrally represented |
| `/dashboard/compliance` | Evidence center; client | `GET /api/v1/compliance/evidence-center` | Authenticated; API-backed | Partially wired | `L E P D S R C`; sample-capable response fields; no evidence freshness/coverage explanation |
| `/dashboard/recommendations` | Recommendations list; client | `GET /api/v1/recommendations` | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; untyped response; no applicability or freshness state |
| `/dashboard/automation` | Latest assessment; client | `GET /api/v1/automation/latest` | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; untyped; disabled and production restriction states incomplete |
| `/dashboard/scans` | Scan history and inventory plan; client | scans list, inventory plan | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; two requests have no aggregate failure model |
| `/dashboard/scans/[scanRunId]` | Scan detail; client | `GET /api/v1/inventory/scans/:id` | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; untyped and no route not-found |
| `/dashboard/reports` | Reports and summary; client | reports list, reports summary | Authenticated; API-backed | Partially wired | `L E 0 P D S R C`; untyped; export/download permission and failure states absent |
| `/dashboard/settings` | Platform/workspace settings; client | platform settings, connector status | Authenticated; nav role-limited | Partially wired | `L E 0 P D S R C Sec`; middleware checks session only; direct URL authorization depends entirely on backend |
| `/dashboard/settings/members` | Members, invitations, teams; client workspace | members, teams, auth/me; invite/resend/revoke/delete/create/archive mutations | Authenticated; nav role-limited | Wired | `E P S R C Sec Resp`; client role gating is not authorization; untyped data and generic action errors |
| `/dashboard/profile` | Personal profile and account panels; client | `GET /api/v1/auth/me`, `PATCH /api/v1/auth/profile` | Authenticated; API-backed | Partially wired | `E C S`; response is `any`; unrelated account/security panels can imply capabilities not backed here |

All dashboard routes inherit one `<main>` from `app/dashboard/layout.tsx`. The new skip link targets that landmark. Public auth pages each own a main landmark; heading hierarchy and landmark consistency still need a route-by-route remediation pass.

## Auth and session architecture

- Access tokens: none found in frontend code.
- Refresh tokens: none found in frontend code.
- Session storage: no `sessionStorage` usage.
- Local storage: used only for sidebar preference and recent search (`dashboard/layout.tsx:68-73`, `GlobalSearchBar.tsx:36-54`), not credentials.
- Cookies: session cookie name is `cloudshield_session`. Server requests read it through `next/headers`; browser requests use `credentials: "include"`.
- JavaScript readability: frontend code never reads the session cookie in client JavaScript. Middleware reads it server-side; HTTP-only/SameSite/Secure attributes are backend responsibilities and were not changed.
- Authorization header: none. Authentication is cookie-based.
- Refresh: no refresh-token flow. Session lifetime is controlled by the backend cookie/session.
- Logout: CSRF-protected `POST /api/v1/auth/logout`, clear in-memory CSRF token, then replace to `/login` and refresh.
- 401 behavior: login handles 401 specifically; the shared client throws a generic error and does not redirect or publish session expiry. Stale authenticated UI can remain rendered.
- Route protection: middleware checks only cookie presence for `/dashboard/:path*`; it does not validate the session or role. Data/action authorization must be enforced by backend endpoints.
- Return URLs: login accepts only values beginning `/dashboard`; this blocks external URLs but should be replaced by an allowlisted internal-path parser.
- Session expiry visibility: absent.
- Cross-tab logout: absent; no `BroadcastChannel` or storage event is used.
- Stale sessions: possible until a navigation or request exposes failure; errors are often shown as generic empty/unavailable states.

## API architecture

Server helper `lib/api.tsx` uses `BACKEND_INTERNAL_URL`, then `NEXT_PUBLIC_API_BASE_URL`, then localhost. It forwards only `cloudshield_session`, uses `cache: "no-store"`, and collapses every failure to `null`.

Client helper `lib/client-api.tsx` uses `NEXT_PUBLIC_API_BASE_URL` then localhost, includes credentials, obtains/caches a CSRF token for mutations, clears it after mutations, parses JSON without validation, and throws `CODE: message`. `useCloudShieldData` retains initial/previous data, has no AbortController despite accepting a signal at the lower level, no cache/deduplication, no retry policy, no stale timestamp, and no status-specific handling.

Direct-fetch bypasses are login and register. CSRF acquisition is also a direct fetch by design. No axios, bearer token, TanStack Query, mutation retry, request deduplication, response schema parsing, correlation-ID extraction, or centralized safe error type exists.

Status handling gaps: 401 is not centralized; 403, 409, 429, 500, and 503 have no shared presentation/retry policy. Register alone recognizes 409. Raw backend messages reach register and monitoring alert dialogs. Correlation IDs are neither extracted from headers nor response bodies.

### Central API error and session-state update

`lib/api-error.ts` now defines a frontend-safe error contract containing only kind, HTTP status, fixed safe message, validated UUID correlation ID, bounded Retry-After seconds, read-retry eligibility, and session-expiry state. It stores no raw response body, provider error, stack, credential, token, SQL/Prisma detail, authorization header, or internal path.

`lib/client-api.tsx` remains cookie-session and CSRF based. No Authorization header is added because the existing frontend has no bearer-token model. Requests execute once, support caller cancellation and bounded timeout, safely inspect only small JSON error bodies for the existing `correlationId` field, prefer `x-correlation-id`, and discard invalid identifiers.

Mutation requests now fail closed on CSRF. A mutation endpoint is never called unless a bounded, independently cancellable CSRF request returns a valid non-empty token. CSRF 401 uses the same session-expiry path; network, timeout, cancellation, unavailable, malformed JSON, and missing-token outcomes throw a safe `ApiRequestError`. There is no shared CSRF promise, so one caller's cancellation cannot abort another caller. Cached state is retained only after successful token validation and is cleared after mutation use or any CSRF failure.

Successful empty responses have an explicit contract: HTTP 204/205, `content-length: 0`, and successful blank bodies resolve as `undefined` without JSON parsing. Non-empty successful bodies remain typed JSON; malformed non-empty JSON becomes a safe unknown response error rather than a network failure. Already-aborted signals are rejected before CSRF or endpoint fetches begin.

On 401, the client clears in-memory CSRF and stale presentation state, broadcasts `cloudshield-session-expired`, and redirects once to `/login`. Only `/dashboard` or a pathname beginning `/dashboard/` is retained; query strings are discarded. Prefix lookalikes, external origins, protocol-like values, controls, double slashes, and backslashes are rejected. The HTTP-only session cookie cannot be read or deleted by client JavaScript and remains owned by backend expiry/logout. The shell stops rendering stale identity while redirecting. A 403 never clears session state.

Error presentation distinguishes unauthenticated, forbidden, conflict, validation, rate limit, unavailable, network, timeout, cancelled, and unknown outcomes. Reads expose explicit retry only for network, timeout, 503, or unknown failures. There are no automatic retries, and mutations are never replayed. Integrated surfaces are dashboard overview, automation, monitoring, and the authenticated shell. Registration no longer displays backend-provided messages, and search no longer logs caught request objects.

Remaining direct fetch calls are login, registration, and CSRF bootstrap. Login and registration retain purpose-specific status handling and should migrate to a public-auth safe-client variant later. The base findings above are retained as historical audit context; this milestone resolves them for the central client and integrated surfaces only.

### Runtime contract-validation update

TypeScript validates frontend source code but cannot prove that a live HTTP response matches its declared type. The central client now parses successful non-empty JSON as `unknown`; when a schema is supplied, only successful Zod `safeParse` output is returned to React. Validation failure becomes `CONTRACT_INVALID` with the fixed message "CloudShield received a response that did not match the expected contract." Zod issues, field paths, raw JSON, provider payloads, and response bodies are not retained or rendered. A valid UUID from `x-correlation-id` is preserved; malformed IDs are discarded. Contract failures do not clear sessions or redirect. Reads may expose explicit retry, while mutations execute once and are never replayed.

| Frontend surface | Endpoint | Runtime schema | Notes |
|---|---|---|---|
| Dashboard overview and shell summary | `/api/v1/dashboard/command-center` | `CommandCenterResponseSchema` plus `FrontendCommandCenterResponseSchema` | Source objects strip unknown keys. The frontend returns an explicit top-level projection and enforces known account connection status, ISO timestamps, finite non-negative counts/durations/ages, and no default-to-zero fallback after failure. |
| Dashboard monitoring badge | `/api/v1/security-monitoring/health` | `MonitoringHealthResponseSchema` plus `FrontendMonitoringHealthSchema` | Source object strips unknown keys; the frontend projection retains only known health, message, timestamp, and metric fields. |
| Monitoring runs list | `/api/v1/security-monitoring/runs` | `MonitoringRunsListResponseSchema` plus `FrontendMonitoringRunsListSchema` | Source object strips unknown keys. The frontend projection removes `organizationId`, arbitrarily nested raw errors, unknown top-level fields, and preserves a conditionally safe error summary. |
| Monitoring run detail | `/api/v1/security-monitoring/runs/:id` | `MonitoringRunDtoSchema` plus `FrontendMonitoringRunSchema` | Uses the same strict boundary and frontend projection as the runs list. |
| Monitoring alerts | `/api/v1/security-monitoring/alerts` | `SecurityAlertsListResponseSchema` plus frontend refinement/projection | Validates enums/counts/timestamps and removes `mappedEvidence` before data reaches React state. |
| Automation latest | `/api/v1/automation/latest` | `FrontendAutomationLatestSchema` | No authoritative response schema exists. A narrow frontend-only projection uses authoritative ID, assessment status/mode, and safety schemas. Event type/status are bounded non-control strings; event messages are bounded and reject control, credential, provider-error, and stack-shaped content. |
| AWS account list | `/api/v1/aws/accounts` | `AwsAccountListResponseSchema` plus `FrontendAwsAccountListSchema` | Source object strips unknown keys. A reusable projected account-item schema enforces 12-digit account ID, known status/connection enums, ISO/null timestamps, and bounded non-negative scores. |
| AWS create/update/archive result | account mutation endpoints | `AwsAccountMutationResponseSchema` plus frontend item projection | Reuses account-item validation directly, independent of list metadata. It creates no synthetic list envelope or sample label and never infers connection success. |

All authoritative schemas above are ordinary Zod objects: they strip unknown object properties rather than passing them through or rejecting the whole response. Frontend schemas nevertheless return explicit allowlisted projections. This is required for the monitoring `mappedEvidence` and `errorSummary` records because their source fields intentionally accept arbitrary record values. Focused assertions inject `AccessKeyId`, `SecretAccessKey`, `SessionToken`, `rawResponse`, `rawError`, `providerError`, `stack`, `credentials`, and `authorization` at top-level and nested positions and prove none survive in parsed frontend results.

Governed execution evidence is not currently consumed by a frontend call site, so no speculative request was added. The authoritative `GovernedExecutionEvidenceResponseSchema`, `MutationOutcomeSchema`, and `MutationReconciliationStatusSchema` were inspected and asserted: `OUTCOME_UNKNOWN` and `MANUAL_REVIEW_REQUIRED` remain exact, unknown outcomes/states fail, approval is not execution success, evidence is not inferred, and `providerRequestId` is never promoted to correlation ID. Existing governed evidence records contain provider-shaped record fields, so a future consuming UI must add a narrow redacted projection before placing evidence in React state.

At the time of the original audit, the unvalidated-response inventory was broader. After the high-risk route, monitoring alert-detail, inventory orchestration, and monitoring lifecycle-mutation milestones, successful responses that remain unvalidated include profile, invitations, notifications, search, connector status, inventory plan, teams/members, inventory resources and resource detail, findings, cost, recommendations, graph, scan list/detail, reports, platform settings, and monitoring evaluate. These routes retain their current behavior until a matching authoritative contract and narrow frontend projection are integrated. The remaining monitoring and inventory list/detail gaps are documented in the current milestone sections below.

### Permission and production guard update

Frontend action availability now uses four distinct presentation layers: `PERMISSION` for an authenticated operator's explicit backend-reported capability, `POLICY` for lifecycle/approval/maker-checker/payload-binding/outcome/reconciliation prerequisites, `ENVIRONMENT` for production restrictions, and `RUNTIME_MODE` for deployment-wide execution disablement. These layers are not interchangeable. Production policy is not fixed by changing role or runtime mode, and runtime disablement is not presented as a production restriction.

`apps/frontend/lib/action-capability.ts` is a pure, fail-closed presentation mapper. Missing permission capability data and unknown blocked reasons become `NOT_CONFIGURED`, never allowed. `APPROVED` alone is not executable. `OUTCOME_UNKNOWN`, `MANUAL_REVIEW_REQUIRED`, and pending reconciliation suppress retry/replay presentation and retain fixed safe guidance. Raw backend errors and arbitrary blocked-reason text are never rendered; only recognized states map to fixed frontend copy.

The authoritative capability milestone adds a required, closed capability object to `CurrentUserResponseSchema`. `GET /api/v1/auth/me` now returns the user, organization, and complete backend-derived capability map as one validated session snapshot. The backend computes every boolean through `@cloudshield/security`'s existing `hasPermission` resolver; the frontend does not copy the role matrix or infer mutation authority from role labels. Explicit `false` maps to `DENIED`; only unavailable or contract-invalid session authority maps to `UNKNOWN` and remains not configured.

Current high-risk consumers migrated to this authority are AWS account management and inventory scan requests, governance prepare/approval actions, and member/team invite, removal, creation, and archive controls. Backend `requirePermission` remains final. Route-registry role filtering remains a navigation convenience only and grants no request authority; direct navigation and endpoint calls still depend on authenticated backend checks.

| Surface | Endpoint/authority | Guard presentation |
|---|---|---|
| AWS accounts | account environment; connector execution eligibility; future explicit `capabilities` map | Privileged controls require an explicit capability boolean. Production records show that mutation is unavailable while read-only assessment/inventory remain visible. Disabled connector execution is a deployment restriction, not a permission failure. |
| Governance plans | `/api/v1/remediation/plans`; approval/lifecycle/execution mode/outcome/reconciliation fields | Queue-execution presentation remains disabled until all authoritative prerequisites and permission capability are present. Unknown/manual-review/reconciliation states expose guidance without retry or replay. |
| Approval requests | `/api/v1/governance/approvals`; requester, status, payload binding, expiry | Maker-checker, expired approval, missing payload binding, completed decision, and missing permission remain distinct. |
| Automation | `/api/v1/automation/latest` safety flags | Safety flags prove that no mutation occurred, but do not report deployment capability. Mutation automation therefore fails closed as unavailable while advisory run history remains readable. |

Governance list projections retain only fields required for restriction presentation. Requested/normalized payloads, provider evidence and request IDs, execution evidence, raw manual-review reasons, and raw blocked-reason strings do not enter React state.

Frontend guards are UX explanations only. Backend `requirePermission` checks, lifecycle transitions, payload binding, maker-checker enforcement, environment policy, and execution-mode gates remain authoritative. Hidden or disabled controls are not security boundaries; direct endpoint calls must still be rejected by the backend.

The earlier audit identified `/api/v1/auth/me` as a capability gap. That gap is closed for the current migrated consumers: the route now reports the membership-derived role and a complete backend-computed capability map. Remaining frontend pages must still migrate individually before the application can be described as capability-complete.

Governance remediation plans also do not expose an authoritative target account/environment field. Execution capability therefore remains fail-closed even when approval and lifecycle fields appear ready; `executionMode: "production"` is treated only as deployment mode and never as evidence that the target environment is production. A future contract should expose the target environment explicitly.

Remaining authority gaps include profile administration, monitoring alert mutations, report generation, scan requests outside the account workflow, settings mutations, team membership editing, member role changes, and untyped recommendation/finding workflows. They should migrate only with matching authoritative keys and narrow response projections.

## Hardcoded, demo, and misleading findings

| Classification | Finding |
|---|---|
| Legitimate enum mapping | Backend statuses in `shared.tsx:47-75`, `account-workflows.tsx:727`, monitoring status switches, and `AWS_SYNC` source labels are domain literals. They should migrate to the typed registry, not be deleted. |
| Harmless label/example | Form placeholders such as `us-east-1, us-west-2`, email/name examples, and copyright years are not operational data. |
| Sample-capable contract | `sampleData` and `sampleDataLabel` appear in account, inventory, finding, and compliance initial payloads. Initial values are empty/false, not fake records. Runtime sample responses must remain visibly labeled. |
| Unsafe runtime hardcoding | Monitoring mutations send `"Acknowledged via UI"` and `"Resolved via UI"` (`monitoring/page.tsx:46,51`) instead of collecting/confirming operator input. |
| Misleading operational state | Empty alert list says "No active alerts. Your environment is secure." (`monitoring/page.tsx:150-153`). No alerts does not prove security, coverage, freshness, or successful evaluation. |
| Misleading fallback | Monitoring health falls back to "Environment monitoring is active" when the API omits a message (`monitoring/page.tsx:91`). |
| Generated client timestamp | Search aliases fabricate `generatedAt` with the browser clock (`GlobalSearchBar.tsx:80`). This is UI-generated metadata and must not be confused with backend freshness. |
| Unresolved placeholder | Graph, cost, recommendations, automation, reports, and settings views are thin untyped presentations over endpoints and lack production state models. |
| Security concern | Raw alert evidence is stringified into the UI (`monitoring/alerts/[id]/page.tsx:148-151`) with no allowlist/redaction. |

No fixed production KPI arrays, account/resource/finding totals, compliance percentages, or cost totals were found in dashboard runtime code. Marketing previews contain illustrative static visuals and must remain clearly outside authenticated operational surfaces.

## Contract mismatches and data risks

- Imported contract types are compile-time casts only; responses are not parsed with exported schemas.
- Monitoring, governance, automation, cost, recommendations, graph, scans, reports, settings, members, profile, and resource detail rely on `any`/generic records.
- Dashboard connector status reduces all account health to connected/not-configured and ignores mixed, failed, stale, disabled, and partial states.
- Server helper returns `null` for unauthenticated, network, parse, 4xx, and 5xx outcomes, making correct UI decisions impossible.
- Empty arrays are frequently indistinguishable from unavailable APIs because initial data is rendered while refresh fails.
- Dynamic route identifiers are interpolated into paths without a shared encoder/validator.

## Accessibility and responsive gaps

- Added skip-to-main and a stable main landmark; global focus-visible and reduced-motion rules now exist.
- Existing dashboard status implementations are not yet migrated to the new icon-plus-text semantic component.
- Multiple custom popovers lack focus management, Escape handling, click-outside behavior, and menu keyboard semantics.
- Mobile backdrop is a clickable `div`; it is pointer-only.
- Search and graph require a dedicated keyboard/screen-reader review.
- Monitoring uses `alert()` and color-heavy severity treatments; tables and action clusters can overflow narrow screens.
- Raw JSON evidence has no structured accessible summary.
- Existing animations and decorative gradients predate this foundation; their removal/review is documented for the visual remediation branch.

## Performance and bundle risks

- The dashboard layout and nearly all views are client components; little data work benefits from server components/streaming.
- Every navigation target is prefetched on dashboard mount.
- Recharts is a significant dependency; usage and route-level code splitting need bundle analysis.
- Global CSS is large and mixes public, auth, dashboard, and premium styles.
- Search has local alias merging and recent-history persistence; request cancellation exists in the low-level signature but is not wired through hooks.
- No request cache, deduplication, or stale-while-revalidate behavior exists.

## Security risks

P0: raw provider-shaped evidence/error text; absent centralized 401/session-expiry handling; UI permission checks can be mistaken for authorization; unvalidated mutation responses.
P1: no correlation-ID extraction, no response size/schema guard, stale UI after failed refresh, invitation token in URL/referrer context, and generated messages that overstate health.
P2: recent search terms in localStorage, `dangerouslySetInnerHTML` for a static landing animation, external docs window without explicit `noopener`, and return-path validation based only on a prefix.

## Priority and implementation order

1. `feat/frontend-permission-production-guards` - route/action permission states and explicit disabled/production-restricted behavior backed by existing API facts.
2. `feat/frontend-monitoring-safety` - remove misleading secure/active fallbacks; validate alert detail/mutations, structure evidence, and replace fixed notes.
3. `feat/frontend-route-contract-migration` - migrate remaining authoritative schemas, starting with auth, connector/inventory, governance, and reports.
4. `feat/frontend-route-state-boundaries` - route loading/error/not-found files and shared empty/error/loading adoption.
5. `feat/frontend-status-migration` - migrate legacy status badges and all operational surfaces to the semantic registry.
6. `feat/frontend-accessibility-responsive` - popover focus, keyboard controls, mobile tables/actions, headings, and graph alternatives.
7. `feat/frontend-server-rendering-performance` - move read-only views toward server components, rationalize prefetch, and measure bundles.
8. `test/frontend-foundation` - add an agreed frontend test runner, then cover status, ResourceId, state, and contract schemas.

Backend dependencies for those branches: documented error envelope and correlation header; authoritative permission/capability fields; session-expiry semantics; freshness timestamps and coverage; production-account restriction facts; redacted alert evidence DTO; and runtime schemas aligned with `@cloudshield/contracts`.

## P0 readiness blockers

The selected high-value responses now have runtime contract validation and redacted monitoring list projections. The application is not production-ready until remaining route contracts, alert-detail evidence projection, privileged-action permission states, and misleading health/empty copy are fixed.

## High-risk route validation milestone

Milestone base: `e15b8cf feat: add frontend permission and production guards (#24)`.

| Frontend consumer | Endpoint | Method | Shared contract | Runtime result |
|---|---|---|---|---|
| Governance view | `/api/v1/remediation/plans` | GET | `RemediationPlanListResponseSchema` | Existing explicit plan projection; guarded-action authority fields retained, raw payload/evidence omitted |
| Governance view | `/api/v1/governance/approvals` | GET | `GovernanceApprovalsResponseSchema` | Existing explicit approval projection; maker-checker identity, expiry, and payload binding retained |
| Governance view | `/api/v1/governance/activity` | GET | `GovernanceActivityResponseSchema` | Added explicit audit projection; arbitrary metadata is discarded |
| Compliance view | `/api/v1/compliance/evidence-center` | GET | `ComplianceEvidenceCenterResponseSchema` | Added bounded counts/timestamps and explicit control/evidence projections; `evidenceJson` is discarded |
| AWS account detail | `/api/v1/aws/accounts/:id` | GET | Account item from `AwsAccountMutationResponseSchema` | Added item-level validation and projection |
| AWS account registry mutation/archive | account mutation endpoints | POST/PATCH | `AwsAccountMutationResponseSchema` | Existing item projection now applied consistently to registry validation and detail actions |
| AWS identity validation | `/api/v1/aws/accounts/:id/validate-identity` | POST | `AwsIdentityValidationResponseSchema` | Added explicit status/message/masked-identity/safety-flag projection |

All migrated reads and mutations use `useCloudShieldData(..., { schema })` or `fetchCloudShieldClient(..., { schema })`. Contract failures remain `CONTRACT_INVALID`; mutation failures are not retried and do not imply success. UUID correlation-ID, 401 session expiry, 403 session preservation, CSRF fail-closed behavior, cancellation, timeout, and empty-success handling remain centralized and unchanged.

The activity projection retains the authoritative event ID, action, target type/ID, actor ID, and creation timestamp. It removes metadata because the shared DTO permits arbitrary values. The compliance projection retains UI-required control/evidence identifiers, enums, source timestamps, counts, and sample flags while removing `evidenceJson`, notes, organization internals, and unknown fields. Credential-like, raw-provider, stack, authorization, and arbitrary nested fields therefore cannot enter these React states.

Routes intentionally not migrated in this milestone:

- Governance detail and mutation endpoints are not currently consumed by the frontend. No calls or DTO guesses were added.
- Governed execution evidence, reconciliation list/detail, rollback, and recommendation detail do not have current frontend consumers with a complete authoritative endpoint-to-schema path. Their shared/backend contract gap must be resolved before UI integration.
- Members, teams, invitations, connector status, inventory plan, reports, recommendations list, cost, graph, scan detail, profile, search, and notifications remain outside this high-risk slice or need dedicated safe projections.

**Inventory Sync Contract Update:**
The `POST /api/v1/aws/accounts/:id/inventory/sync` and `POST /api/v1/inventory/scans` routes now use dedicated authoritative orchestration contracts. `AwsInventoryStartResponseSchema` remains specific to the older `/inventory/start` endpoint. Orchestration outcomes are separate from scan lifecycle: `QUEUED` means the queue accepted the request, not that scanning completed. `DUPLICATE_ACTIVE` is an item-level planned outcome and differs from an idempotency `CONFLICT`; a top-level `PLANNED` response may therefore contain blocked or duplicate-active items.

The account frontend validates the normal orchestration envelope, requires a non-dry-run response with exactly one item for the requested account record, and explicitly projects only workflow fields. A malformed HTTP 200 or 202 response becomes `CONTRACT_INVALID`. Queue-add failure normally atomically transitions the run to a safe persisted `FAILED` state and records `inventory.scan.queue_failed`; no AWS call occurred. If both queue insertion and that failure-transition transaction fail, the initially created `QUEUED` row may remain. The API still returns only fixed safe copy, exposes and logs neither raw failure, and active-run deduplication prevents a second enqueue. This residual state is not fully reconciled in this milestone. If queue acceptance succeeds but confirmation persistence fails, the run also remains `QUEUED` because execution may already happen. This milestone does not close the remaining inventory list/detail response-contract gaps and does not claim full inventory frontend completion.

Remaining risk: several shared governance schemas contain defaults and arbitrary record fields. The migrated frontend outputs do not expose those records, but future detail pages must use explicit allowlists and authoritative fingerprint/evidence contracts rather than spreading shared DTOs. Recommended next branch: `feat/frontend-monitoring-alert-detail-contract`.

## Monitoring alert-detail contract milestone

The monitoring detail trust boundary is now: HTTP body parsed as unknown, `SecurityAlertDtoSchema` validation, frontend-only identifier/text/timestamp/count/lifecycle refinements, explicit field projection, then React state. A successful status alone cannot produce a rendered alert.

| Frontend consumer | Endpoint | Method | Shared contract | Runtime handling |
|---|---|---|---|---|
| Alert detail | `/api/v1/security-monitoring/alerts/:id` | GET | `SecurityAlertDtoSchema` | `FrontendSecurityAlertDetailSchema`; explicit projection and safe read retry |
| Alert detail/list acknowledgement | `/api/v1/security-monitoring/alerts/:id/acknowledge` | PATCH | `SecurityAlertLifecycleMutationResponseSchema` | Strict HTTP 200 `{ status: "ok" }` acceptance, then exactly one validated detail/list refresh |
| Alert detail/list resolution | `/api/v1/security-monitoring/alerts/:id/resolve` | PATCH | `SecurityAlertLifecycleMutationResponseSchema` | Strict HTTP 200 `{ status: "ok" }` acceptance, then exactly one validated detail/list refresh |
| Monitoring evaluate | `/api/v1/security-monitoring/evaluate` | POST | `EvaluateMonitoringResponseSchema` | Strict HTTP 200 `QUEUED` acceptance, then exactly one validated active monitoring-view refresh |
| Embedded alert evidence | Detail response `mappedEvidence` | embedded | Arbitrary record array only | Entire field removed; only validated `evidenceCount` is retained |

The safe alert projection retains IDs and references, bounded title/description, strict severity/status/category enums, source references, authoritative timestamps, and a finite non-negative integer evidence count. `OPEN` and `ACKNOWLEDGED` reject a non-null `resolvedAt`; `RESOLVED` requires a valid `resolvedAt`. Unknown lifecycle values fail the whole response as `CONTRACT_INVALID`.

Alert acknowledgement and resolution use the strict HTTP 200 `{ status: "ok" }` acceptance envelope. Acceptance alone does not confirm alert lifecycle. The detail page confirms lifecycle through exactly one validated alert-detail read, while the list confirms through exactly one validated alerts-list refresh. Monitoring evaluation uses the strict HTTP 200 `{ status: "QUEUED", message: "Security monitoring evaluation queued successfully." }` envelope. `QUEUED` confirms queue acceptance only; it does not mean evaluation started or completed, does not prove alerts changed, and does not prove the environment is secure. After valid evaluation acceptance, the current monitoring view performs exactly one validated refresh. A malformed or blank acceptance response skips confirmation and becomes `CONTRACT_INVALID`. A failed or malformed confirmation refresh leaves the lifecycle or evaluation state unconfirmed. These actions execute once without automatic retry, mutation replay, optimistic run creation, or optimistic health or alert updates.

The route now distinguishes announced loading, safe contract/network/permission errors, truthful 404 presentation, and a valid zero-evidence state that makes no security claim. Correlation IDs remain UUID-validated by the centralized error model. The alert list empty state was also corrected so an empty list does not claim the environment is secure.

## Monitoring run-detail contract milestone

| Frontend consumer | Endpoint | Method | Shared contract | Runtime handling |
|---|---|---|---|---|
| Monitoring runs list | `/api/v1/security-monitoring/runs` | GET | `MonitoringRunsListResponseSchema` | `FrontendMonitoringRunsListSchema`; validates items via `FrontendMonitoringRunSchema` which drops unsafe nested fields |
| Monitoring run detail | `/api/v1/security-monitoring/runs/:id` | GET | `MonitoringRunDtoSchema` | `FrontendMonitoringRunSchema`; explicit projection that enforces invariants and drops nested unsafe fields |

The monitoring runs list and detail endpoints now share the strict `MonitoringRunDtoSchema` as their authoritative input boundary. The backend correctly implements safe projection logic, discarding unapproved top-level fields and ensuring `errorSummary` is safely mapped to `message`, `category`, and `retryable`. The backend explicitly fails closed with a 404 response indicating "Monitoring run not found." for runs belonging to other tenants.

On the frontend, `FrontendMonitoringRunSchema` ensures that `organizationId` is removed and drops nested unsafe fields present in `errorSummary`. The schema also validates cross-field dependencies, verifying that `completedAt` is null for `QUEUED` and `RUNNING` statuses and non-null for `COMPLETED` and `FAILED` statuses. Counters are bounded to finite non-negative integers.


## Monitoring evidence response-contract milestone

The security-monitoring alert list and detail endpoints now share one explicit safe backend projection validated by `SecurityAlertDtoSchema`. Arbitrary persisted `mappedEvidence` does not cross the HTTP boundary. The old top-level HTTP response fields `evidenceCount`, `sourceType`, and `sourceId` are replaced by the strict `MonitoringAlertEvidenceSummarySchema`.

The safe summary contains only:

- `recordedCount`
- `sourceType`
- `sourceId`

`evidenceSummary.recordedCount` is persisted metadata only. It does not prove completeness, freshness, authenticity, independent verification, or environmental safety.

`sourceType` and `sourceId` are independently sanitized bounded scalar values. An invalid persisted value becomes `null` without discarding a valid companion field.

The frontend validates the strict shared DTO before removing `organizationId` during its explicit projection. Evidence persistence and worker behavior remain unchanged. Missing and cross-tenant alert-detail responses remain indistinguishable.

No dedicated evidence-history endpoint exists. No evidence-history endpoint or evidence-history UI was added.

## Monitoring capability authority milestone

Every security-monitoring route is explicitly controlled by the project's central authoritative permission resolver (`requirePermission`). The backend remains the security boundary, and frontend gating is for usability only.

The role-to-capability matrix provides explicit definitions for all active roles and disabled users:
- `OWNER`, `ADMIN`, `SECURITY_OPERATOR`: Full monitoring authority (Read, Evaluate, Acknowledge, Resolve).
- `CLOUD_OPERATOR`, `AUDITOR`, `VIEWER`: Monitoring read only.
- Disabled User: No monitoring authority.

Disabled user sessions are safely handled by the `requireAuth` platform authentication semantics, properly returning a 401 instead of a 403. Side-effect safety is guaranteed by strictly denying queue execution or DB mutations on 403. Unknown role handling explicitly fails closed by returning a 403 rather than escalating to `VIEWER_PERMISSIONS`.
