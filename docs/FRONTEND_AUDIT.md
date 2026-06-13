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

1. `feat/frontend-api-error-session-states` - typed API error, correlation IDs, 401/session expiry, cancellation, and safe status-specific UX.
2. `feat/frontend-contract-validation` - parse real responses with existing contract schemas; remove `any` from monitoring and mutation paths first.
3. `feat/frontend-permission-production-guards` - route/action permission states and explicit disabled/production-restricted behavior backed by existing API facts.
4. `feat/frontend-monitoring-safety` - remove misleading secure/active fallbacks; redact/structure evidence; replace browser alerts and fixed notes.
5. `feat/frontend-route-state-boundaries` - route loading/error/not-found files and shared empty/error/loading adoption.
6. `feat/frontend-status-migration` - migrate legacy status badges and all operational surfaces to the semantic registry.
7. `feat/frontend-accessibility-responsive` - popover focus, keyboard controls, mobile tables/actions, headings, and graph alternatives.
8. `feat/frontend-server-rendering-performance` - move read-only views toward server components, rationalize prefetch, and measure bundles.
9. `test/frontend-foundation` - add an agreed frontend test runner, then cover status, ResourceId, and state components.

Backend dependencies for those branches: documented error envelope and correlation header; authoritative permission/capability fields; session-expiry semantics; freshness timestamps and coverage; production-account restriction facts; redacted alert evidence DTO; and runtime schemas aligned with `@cloudshield/contracts`.

## P0 readiness blockers

The milestone foundation itself is reviewable once typecheck/build/hygiene pass. The foundation validates correlation IDs before display/copy and preserves truthful backend status labels, but the application is not production-ready until centralized session expiry, correlation-ID extraction, monitoring response validation/evidence redaction, privileged-action permission states, and misleading health/empty copy are fixed.
