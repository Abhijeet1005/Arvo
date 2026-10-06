# Loan Advisor Redesign — Standalone B2B SaaS Direction

This redesign turns the existing loan-advisor feature into a standalone lending-operations product rather than another tab inside the Arvo support dashboard. The product should feel like a focused workspace that lending sales, operations, and compliance teams can evaluate: operators can see readiness and outcomes, rehearse the live agent, create customer links, inspect structured handoffs, and configure the voice agent without code; customers receive a calm, white-labelled, mobile-first call experience. The implementation should replace the current three-tab `LoanWorkspace` information architecture, not merely reskin its cards. Existing `/api/loan/**` request and response contracts, ElevenLabs behavior, file-backed persistence, analysis rules, and public URL `/loan/call/[token]` remain unchanged.

## Product position

**Working product label:** **Arvo Lending** in the operator console, with the descriptor **Voice qualification for lending teams**. The customer page is white-labelled to `settings.companyName` and does not display Arvo. This creates a coherent product identity without requiring a new branding data model.

The product promise is: **turn a loan enquiry into a structured, review-ready borrower profile through a consistent voice conversation, with a human remaining responsible for the lending decision.** It should sell operational control, faster qualification, standardized intake, and visible risk flags—not “AI magic.” The agent must never be represented as approving a loan, deciding eligibility, quoting a rate, or replacing a regulated human process.

The primary operator is a lending operations or inside-sales manager. Secondary users are a quality/compliance reviewer inspecting calls and a sales engineer rehearsing the configured experience for a prospective lending company. The current product is browser-based WebRTC qualification and customer-link distribution, not outbound phone dialling; the UI and sales copy must not imply telephony that does not exist.

### Assumptions and constraints

- There is one current loan agent and one workspace. This is not a multi-agent, multi-tenant design.
- Selecting an OpenAI model means selecting an OpenAI GPT model offered through ElevenLabs’ `/v1/convai/llm/list`; there is no direct OpenAI API key or direct OpenAI integration in this scope.
- A share link always uses the current live agent settings when the call begins. It is not a versioned snapshot and it can be used for more than one call until revoked or expired.
- Calls and links come from the current local store, capped by the existing implementation at 200 calls and 500 links. Dashboard analytics must be described as retained activity, not an authoritative data warehouse.
- Public links are bearer links. Their expiration and revoke controls are meaningful safeguards, but they are not authentication.
- Existing file persistence, deployment security, and dashboard access controls are not upgraded by this frontend redesign. The UI must not claim enterprise-grade credential storage, audited consent, regulatory certification, or legal compliance.
- There is no configurable logo, brand color, support contact, privacy URL, or terms URL. The public experience therefore uses a neutral visual system, the configured company name, and a generated text monogram.

## Technology stack — locked for implementation

Keep the existing production stack: Next.js 15 App Router, React 19, JavaScript/JSX, Tailwind CSS 3.4, CSS custom properties, `class-variance-authority`, `clsx`/`tailwind-merge`, Lucide icons, and `@elevenlabs/react` with the existing `ConversationProvider` and `useLoanCall` WebRTC flow. Continue using server route handlers for secrets and ElevenLabs REST calls. Add no runtime UI, charting, animation, form, or state-management dependency; tables, bars, dialogs, drawers, and motion are implementable with React, semantic HTML, Tailwind, and small scoped CSS.

The deployment remains Next’s `output: 'standalone'`, which is appropriate for the Raspberry Pi target. New console code should be route-split so the public call page does not download console components. Inter remains the only font; do not add a second webfont.

For automated implementation tests, use Vitest plus React Testing Library for pure/client behavior and Playwright for route-level browser checks. These are dev-only tools and should be exact-pinned when added; they do not ship in the standalone production output. The repository currently has no project-owned test script or harness, so that setup is part of implementation validation, not production architecture.

## Standalone information architecture

Use a route group so the operator console and public customer page share `/loan` styles but not layout chrome:

| URL | Purpose | Source route |
|---|---|---|
| `/loan` | Operational overview | `app/loan/(console)/page.js` |
| `/loan/calls` | Search, filter, and inspect retained calls | `app/loan/(console)/calls/page.js` |
| `/loan/links` | Create and manage customer links | `app/loan/(console)/links/page.js` |
| `/loan/rehearsal` | Run a live borrower rehearsal | `app/loan/(console)/rehearsal/page.js` |
| `/loan/agent` | Configure persona, intelligence, voice, script, behavior, and connection | `app/loan/(console)/agent/page.js` |
| `/loan/call/[token]` | Public customer call experience | existing `app/loan/call/[token]/page.js` |

Add `app/loan/layout.js` only to import the scoped loan stylesheet and return `children`. Add `app/loan/(console)/layout.js` for the operator shell and data provider. Keeping `call/[token]` outside `(console)` guarantees that customer pages never inherit operator navigation, account data, or configuration bundles.

Replace the current `LoanWorkspace` tab switching and `?tab=` convention with real URLs. This makes browser navigation, refresh, bookmarks, access logs, loading boundaries, and future permissions predictable. Redirect legacy `/loan?tab=links` to `/loan/links` and `/loan?tab=config` to `/loan/agent` client-side during the migration; `/loan?tab=call` resolves to `/loan/rehearsal`. The canonical navigation should only generate the new paths.

## Navigation and shell

The desktop console uses a fixed 232 px sidebar, a compact 56 px top bar, and a fluid content canvas capped at 1440 px. The sidebar starts with the Arvo Lending mark and workspace/company name, then these items in order: **Overview, Calls, Share links, Rehearsal, Agent**. The order follows the operating loop: assess, review, distribute, test, configure. Use exact matching for Overview and prefix matching for the other items. The bottom of the sidebar contains a quiet connection block showing one of `Ready`, `Needs setup`, `Sync pending`, or `Provider unavailable`, plus remaining ElevenLabs credits when available. “Live” must not be shown merely because a page loaded.

The top bar contains the current page title, optional retained-activity range control on Overview/Calls, theme control for the operator console, and one contextual primary action. Overview uses **Start rehearsal**; Calls uses **Start rehearsal**; Share links uses **Create link**; Agent uses no duplicate save action because its save bar is persistent. Avoid global notification, search, and user-menu affordances until those functions exist.

At widths below 1024 px, replace the fixed sidebar with a top app bar and an accessible slide-over navigation drawer. Do not create a bottom navigation because configuration and live-call controls already occupy the bottom safe area on small screens. The shell must preserve focus, close on Escape and route selection, restore focus to the menu trigger, and prevent background scrolling while open.

`components/dashboard-shell.jsx` must bypass its Arvo support shell for every path starting with `/loan`, not only `/loan/call/`. The loan console supplies its own shell through the route group. `components/top-loader.jsx` must remain absent on `/loan/call/**`; for operator `/loan/**` routes it should use a flat loan-primary bar with no emerald glow so global Arvo styling does not leak into the standalone product.

## Shared console state

Create `app/components/loan/console/LoanConsoleProvider.jsx` and mount it inside `(console)/layout.js`. It owns the existing core fetches and exposes `{ core, options, links, loading, errors, refreshCore, refreshOptions, loadLinks, mergeCall, removeCall, trackCall }` through context.

On mount it fetches `GET /api/loan` and `GET /api/loan/options` in parallel. Links load only when Overview or Share links requests them, then remain cached across console navigation. The provider preserves the current call tracking behavior: poll `GET /api/loan/calls/[id]` every three seconds for at most three minutes, deduplicate polling by call ID, and track at most five non-final calls discovered at bootstrap. If the local three-minute window expires, retain the call as processing in the UI and label it **Still processing—check again shortly**; do not persist a fabricated failure. Use `AbortController` to stop in-flight fetches on provider unmount.

The shell may render when optional provider data is unavailable. A failed `/api/loan` bootstrap is fatal to page content but not to navigation; show a full-width retry state inside the content area. A failed `/api/loan/options` request is recoverable: calls and links remain usable while provider-dependent controls show an inline retry state.

## Overview page

The Overview is an operations page, not a marketing hero. Its header reads **Loan qualification overview** with a one-line status such as “Review recent outcomes, follow up on flagged conversations, and keep the customer experience ready.” Primary action: **Start rehearsal**. Secondary action: **Create customer link**.

Immediately below, show a single horizontal readiness strip rather than four disconnected setup cards. It reports the selected agent and company, model provider/model ID, selected voice name, and connection state. A warning action deep-links to the relevant Agent section (`/loan/agent?section=connection` or `?section=voice`). Readiness is computed from existing data:

- `Ready`: API key configured, an agent ID exists, and the selected voice is present in the loaded account voices.
- `Needs setup`: key is absent or agent ID is absent.
- `Voice unavailable`: the voices request succeeded and the selected voice ID is not present.
- `Provider unavailable`: options failed; do not infer that the saved agent stopped working.
- `Sync pending`: the current browser session received a successful settings save with a warning. This is session state because no persisted sync-status field exists.

The KPI row contains four decision-useful values for the selected retained period (default 30 days): **Completed calls**, **Qualification rate**, **Needs review**, and **Active links**. Qualification rate is `qualified / completed calls with a result`; render an em dash when the denominator is zero rather than `0%`. Needs review is the union of `result.needs_human_review`, `result.do_not_call`, and a compliance evaluation whose result is not `success`, deduplicated by call. Active links come from `GET /api/loan/links`. Below the row, display average completed-call duration as supporting text, not another oversized KPI.

The desktop body is an 8/4 grid. The main column contains **Attention queue** followed by **Recent calls**. The queue shows at most five DNC, human-review, policy-flagged, failed, or long-processing calls, in that priority order; an empty state says “No conversations need attention.” Recent calls is a compact table with Customer, Outcome, Amount, Policy, Started, and Duration. Selecting a row opens the same detail drawer used on the Calls page.

The side column contains **Outcome mix**, rendered as five labelled horizontal CSS bars (Qualified, Callback, Not interested, Wrong number, Do not call), and **Agent readiness**, a short checklist for connection, agent, voice, and model catalog. Do not add a chart library, fake trend arrows, revenue estimates, approval rates, or comparison percentages because the APIs do not provide them.

When there are no calls, replace analytics with a three-step activation state: configure the connection, review the agent, run a rehearsal or create a customer link. Completed steps derive from actual state; no confetti or illustrated empty-state art.

## Calls workspace

`/loan/calls` replaces stacked result cards with a dense, inspectable master/detail workflow. The header contains a search input and filters for Outcome (`all`, the five existing outcomes, `processing`, `failed`) and Review status (`all`, `needs review`, `DNC`, `policy flagged`). All filtering and sorting are client-side over the retained `/api/loan` payload. Search matches customer/result name and phone; it must not search raw JSON that is not already displayed.

On desktop, use a semantic table with columns: Customer, Outcome, Requested amount, Profile, Policy check, Started, Duration, and an overflow menu. “Profile” is a compact `captured fields / 14` count based only on the existing structured result keys; it is not an eligibility score. Pending and failed calls use textual statuses, not blank cells. Default ordering is newest first, preserving API order.

Selecting a row opens a 480 px right drawer while preserving table context. The drawer header shows customer name, outcome, time, duration, and prominent DNC/human-review flags. Its body has three sections: **Borrower profile** (existing facts), **Conversation review** (notes, summary, policy result and rationale), and a collapsed **Technical output** disclosure containing copyable end-of-call JSON. Call the automated evaluation **Conversation policy check**, not “Compliance passed”; supporting copy states that it checks configured conversation rules and is not legal approval. Keep PAN masked exactly as returned by the server.

Removing a call is an overflow action with a confirmation dialog: “Remove this call from the local activity log? The ElevenLabs conversation and recording are not deleted.” Only `DELETE /api/loan/calls/[id]` is called. Do not imply provider deletion. On mobile, render the same dataset as compact list rows rather than forcing horizontal table scrolling; tapping a row opens a full-height detail sheet.

## Live call rehearsal

`/loan/rehearsal` should feel like a controlled rehearsal studio, not a large animated call orb. Before a call, use a two-column stage. The left column is **Scenario setup** with required Customer name, optional Phone on file, and a compact “Agent being tested” summary. The right column is a quiet preview of the six conversation stages and a short explanation that the operator plays the borrower. If the API key is absent, replace the start control with **Complete connection setup**. If the selected voice is known to be missing, disable start and link directly to Voice settings.

The primary control is a normal labelled button, **Start rehearsal**, with a phone icon. Request microphone permission only after this user action. Once connecting, freeze scenario inputs. During the call, switch the page into a 5/7 split: a left status rail with elapsed time, speaking/listening state, six-stage progress, and a persistent **End call** button; a right conversation monitor with the live transcript. Customer and agent turns are visually differentiated by a slim edge marker and label rather than chat-bubble decoration. Keep the newest turn in view unless the operator has manually scrolled upward; in that case show a **Jump to latest** control instead of stealing scroll position.

Motion is functional: a three-bar audio indicator moves only while the agent is speaking; connection and stage changes cross-fade over 160 ms. Do not use expanding pulse rings. Under `prefers-reduced-motion`, use a static speaking icon and immediate state changes.

On disconnect, keep the call on screen and show **Building borrower profile…** while the existing polling runs. When analysis arrives, show the reusable call-detail content inline with **Open in Calls** and **Run another rehearsal** actions. If processing exceeds three minutes, explain that the call remains in Calls and can finish later. A registration failure must not interrupt a live WebRTC session; show an operator-only warning that the call may not appear in activity. Public calls retain the existing fire-and-forget registration behavior without exposing that warning.

## Share-link management

`/loan/links` starts with a page header, a single sentence explaining that links use the current live agent at call time, and **Create link**. This “current settings” notice is important because links are not snapshots. The creation form belongs in an accessible modal dialog on desktop and a full-height sheet on mobile, not in a permanent card above the list.

The dialog fields are Customer name, Phone on file (optional), Internal note (optional), and Expiry. Preserve the existing 7 days, 30 days, and Never choices, with 7 days selected by default. The submit action is **Create customer link**. After success, replace the form with a focused success state containing the absolute URL, **Copy link**, **Open customer view**, and **Done**. Clipboard failure leaves the URL selected in a read-only input and instructs the operator to copy manually; it is not a silent no-op.

The management table has Customer, Phone, Status, Calls, Created, Expires, and Actions. Filters are `All`, `Active`, `Expired`, and `Revoked`; search matches customer name, phone, and internal note. Actions are Copy, Open (active only), and Revoke (active only). Revoke uses a confirmation dialog and explains that past call records remain. There is no regenerate, extend, edit, send by SMS, or one-time-link action because no current API supports those operations.

Use status text plus icon/shape so status never relies on color alone. When the list fetch fails, retain any last good rows, show a table-level error with **Retry**, and do not replace the whole page. Empty filtered results distinguish “No links yet” from “No links match these filters.”

## Agent configuration

`/loan/agent` is a settings workspace, not a stack of decorative cards. Use a sticky 184 px section index on desktop and one bordered settings canvas approximately 760 px wide. Sections are **Identity, Intelligence, Voice, Conversation, Script, Connection**. Selecting an item scrolls to the section and updates `?section=` with `history.replaceState`; this supports deep links without splitting one unsaved form across routes. On mobile, replace the sticky index with a native section select followed by the same single-column form.

All edits stay in one local form object initialized from `GET /api/loan`. Do not auto-save because a save can update or create the remote ElevenLabs agent. A persistent bottom save bar appears only when dirty and shows **Discard** and **Save & sync**. Navigating away while dirty prompts once; changing section does not. **Restore defaults** requires confirmation, changes only local form state, and still requires Save & sync.

### Identity

Show Company name, Agent name, Partner banks, and the optional spoken Regulatory claim. Company, agent, and partner-bank values are required by the UI because blank submissions would otherwise silently retain prior server values. Regulatory claim copy must say: “Spoken only when a customer asks. Enter only a claim your legal/compliance team has verified.” Never convert this field into a visible certification badge.

### Intelligence

Group the live model list by OpenAI, Google, Anthropic, and Other exactly as `providerOf`/`PROVIDER_ORDER` do. Each option displays provider and model ID; selecting a model resets reasoning to its first supported effort, preserving current behavior. Explain that models are hosted through ElevenLabs and that smaller/flash models typically respond faster. If the model catalog fails, show the saved model read-only with **Retry catalog**; do not invite arbitrary model IDs in the polished UI. Existing settings can still be saved if Intelligence was not changed.

Temperature remains a 0–1 control, but label it **Response variation** with endpoints **Strict script** and **More flexible**. Keep the numeric value visible. Reasoning is hidden when the selected model has no supported efforts.

### Voice

The selected voice receives a compact featured row with preview, language/accent metadata, and a missing-account warning when applicable. Account voices appear in a searchable, single-select list; Hindi/Indian voices are the default filter, with an explicit All voices option. **Browse voice library** opens a large dialog using the existing search filters and pagination. “Add & use” continues to copy the library voice into the account and selects it locally; the dialog must clearly state that Save & sync is still required.

Voice model, speaking speed, stability, and similarity remain in the same section. Keep the current language-compatible TTS model swap from `ttsModelFor`; the UI should explain when switching language automatically changes the voice model. Preview playback is exclusive through the existing provider—starting one preview stops another.

### Conversation

Show Language, conditional Hinglish mode, silence check-in, turn-taking, hang-up-after-silence, and maximum call duration. Group the first two as language behavior and the rest as timing. Values and choices come from `lib/loan/options.js`; do not duplicate magic values in components.

### Script

Opening line appears first with a rendered preview showing only safe sample values. The system prompt defaults to a readable generated-script preview. **Customize script** creates a local copy and unlocks the editor; **Return to generated script** clears the custom prompt after confirmation. The editor shows a character count and accepted placeholders. Unknown placeholders block Save and link to the exact offending token. Do not expose the raw end-of-call schema as editable in this phase because the current API does not support configuring it.

### Connection

Present ElevenLabs as the voice and model runtime. Show key source, only its last four characters, credits/plan when available, and a password input to replace the key. Hide `.agent.json` implementation detail in the primary UI; an expandable “Credential handling” note can accurately say the key is stored on this deployment and is never returned to the browser after save. Switching back to the environment key remains available when `envAvailable` is true. Changing account must trigger core/options refresh and a voice compatibility check before the next call.

## Customer-facing `/loan/call/[token]` experience

The public experience is fixed to a neutral light theme for predictable white-label presentation, uses `min-height: 100dvh`, and is designed first at 320–480 px. It must not inherit the console shell, theme toggle, top loader, transcript, API/agent IDs, internal note, credits, model name, or Arvo branding. Keep generic metadata and never put customer name, phone, company name, or token-derived data into title, description, Open Graph, or structured metadata.

### Ready state

Use a small company monogram and `companyName` at the top, followed by the label **Automated voice assistant**. The main copy is “Hi {customerName}, {agentName} will guide you through a few questions about your loan enquiry.” Add a compact three-item “What we’ll cover” list: what the customer needs, a few profile details, and preferred follow-up. Do not show every data field before the call.

Before the CTA, show two plain-language notices:

1. “This voice conversation may be recorded and analysed by {companyName} to follow up on your enquiry.”
2. “Never share an OTP, PIN, password, CVV, full card number, bank login, or Aadhaar number.”

Require a session-only checkbox, **I’m ready to continue with this automated voice assistant**, before enabling **Start voice conversation**. This is a disclosure and UX acknowledgement only; the current API does not persist or audit consent, so the product must not market it as a consent record. A short microphone note explains that the browser asks for access after tapping Start.

### Connecting and live states

Connecting uses a deterministic status sequence—Requesting microphone, Preparing voice session, Connecting—with one active line and no fake completed steps. During a call, show a compact header with company name, elapsed time, speaking/listening text, and a subtle three-bar audio state. Below it, show a segmented six-stage rail, the current plain-language stage, and at most one safe `highlight` from `update_progress`. Do not show a transcript or a form-like list of missing fields; customers should understand progress without feeling surveilled or evaluated.

Place **End call** in a sticky bottom safe-area footer and end immediately when tapped; do not trap the customer behind a confirmation. Show “Keep this page open while we talk” near the control because mobile browser suspension can disrupt WebRTC. All controls have at least a 44 px target.

### Ended state

If the close stage was reached, use **You’re all set**; otherwise use the honest title **The call has ended**. Show completed stage labels and the next-step copy “A member of {companyName} may follow up after reviewing the information you shared.” Do not promise approval, timing, rate, or a callback at the preferred time. If the conversation ended before meaningful progress or a connection error occurred, offer **Try again** by reloading the same still-usable link. Never display PAN, phone, income, CIBIL, raw transcript, or extracted borrower profile back to the public page.

### Unavailable and failure states

Keep distinct copy for expired, revoked, and invalid links. Add a fourth **temporarily unavailable** state for server/upstream failures with a Retry action; a 5xx must not be mislabelled “invalid.” If the link expires or is revoked between page load and session creation, the session endpoint’s 410 response replaces the ready state with the relevant unavailable state. No technical status code or provider name appears to the customer.

## Visual system

This should look like a 2026 enterprise operations product: quiet structure, compact data, strong hierarchy, and restrained brand expression. It must not use purple/blue gradients, glass panels, glowing orbs, excessive pills, giant marketing typography, or an icon inside every card.

Add `app/loan/loan.css` and scope semantic variables beneath `.loan-product`. Suggested light tokens:

- Canvas `#F5F7F9`
- Surface `#FFFFFF`
- Subtle surface `#EEF2F5`
- Primary ink `#17212B`
- Muted ink `#66727F`
- Border `#D8E0E7`
- Brand/primary `#174B6E`
- Primary hover `#103B58`
- Success `#17745B`
- Warning `#9A5B13`
- Danger `#B42318`
- Focus `#2E90FA`

Map these to the existing semantic HSL variables inside the scope so shared neutral primitives can still work. Add a dark operator-console token set under `.dark .loan-console`; `.loan-public` explicitly supplies light tokens regardless of the root theme. Use color only as reinforcement: every success, warning, policy, DNC, and processing state also has text and/or an icon.

Typography remains Inter. Page titles are 24–28 px/650, section titles 16–18 px/600, table and form copy 13–14 px, helper copy 12 px, and numeric metrics use tabular figures. Avoid ubiquitous uppercase micro-labels; reserve uppercase for very short status metadata when it improves scanning. Keep line lengths below roughly 70 characters in settings guidance.

Use an 8 px spacing system. Console controls are 40 px high; public controls are 44–48 px. Default radius is 8 px, large panels 10–12 px, and status pills fully rounded only when semantically useful. Main content uses borders and spacing rather than a card around every subsection. Shadows are limited to modal/drawer elevation and sticky bars.

Motion lasts 120–180 ms for hover, focus, disclosure, drawer, and state transitions. Content may move at most 4 px. No continuous animation except the live speaking bars, and those stop under `prefers-reduced-motion`. Skeletons should match final geometry and never shimmer indefinitely after an error.

## Responsive behavior

- **1440 px and above:** 232 px fixed sidebar, content max 1440 px, overview 8/4 grid, rehearsal 5/7 split, agent section rail plus form canvas.
- **1024–1439 px:** fixed sidebar remains; secondary columns narrow, lower-value table columns may hide, and call drawer remains 440–480 px.
- **768–1023 px:** navigation becomes a drawer; overview and rehearsal stack; tables keep Customer, Outcome/Status, Started, and action while details move into the drawer.
- **Below 768 px:** 16 px page gutters, single-column forms, list representations for calls/links, full-height detail and creation sheets, sticky bottom primary actions with `env(safe-area-inset-bottom)`, and no horizontal page scrolling.
- **Public page:** test at 320, 360, 390, and 480 px widths and short landscape heights. The active call view prioritizes status and End call; supporting safety copy may collapse behind “Safety information,” but must remain available.

All pages target WCAG 2.2 AA: visible focus, keyboard-complete dialogs/drawers, semantic headings/tables/forms, labels and described-by hints, `aria-live` only for concise status updates, no color-only distinctions, reduced-motion support, and 200% zoom without content loss. Focus moves into overlays on open and returns to the trigger on close.

## Trust and compliance UX

Trust is conveyed through truthful behavior, not shield decoration. The customer page explicitly discloses automation, recording/analysis possibility, microphone use, and sensitive information that must never be shared. It gives the customer an always-visible way to end the call. The operator UI labels the automated evaluation as a conversation-policy check and distinguishes it from human review and legal compliance.

DNC is the highest-priority outcome. Show **Do not contact** in danger styling in Overview, Calls, and detail views, and never present a follow-up CTA on that record. `needs_human_review` and failed policy checks remain separate flags because they have different meanings. The UI never calculates or displays an approval/eligibility score from income, CIBIL, age, or other profile data.

PAN masking is owned by `lib/loan/analysis.js` and must not be reimplemented in the client. Public metadata remains generic. The customer phone returned by the existing public endpoint is used only as a dynamic variable and is never rendered; changing that response contract or moving dynamic-variable assembly server-side is separate backend work. API keys remain server-side and only the last four characters/source reach the client.

When removing a local call, state that the provider copy remains. When revoking a link, state that prior calls remain. Never claim data deletion, encryption, RBI registration, fraud prevention, or certification unless the underlying platform later supplies and verifies those capabilities.

## Existing API integration — no contract changes

| Operation | Existing API | UI integration |
|---|---|---|
| Bootstrap settings/calls | `GET /api/loan` | Console provider; overview, calls, rehearsal summary, agent form |
| Provider catalogs/status | `GET /api/loan/options` | Readiness, model/voice controls, credits; partial response supported |
| Save and sync settings | `PUT /api/loan` | Agent Save & sync; consumes `settings`, optional `agentId`, optional `warning` |
| Set/fallback API key | `PUT` / `DELETE /api/loan/key` | Agent Connection section |
| Start operator session | `POST /api/loan/session` | Rehearsal through `useLoanCall` |
| Register a call | `POST /api/loan/calls` | Operator and public `onCallStarted` callbacks |
| Poll/remove a call | `GET` / `DELETE /api/loan/calls/[id]` | Console provider and Calls actions |
| List/create links | `GET` / `POST /api/loan/links` | Overview active count and Share links |
| Revoke link | `DELETE /api/loan/links/[token]` | Share-link row action |
| Public link bootstrap | `GET /api/loan/links/[token]/public` | Existing server page fetch; only public-safe fields rendered |
| Public session | `POST /api/loan/links/[token]/session` | Public `useLoanCall` instance |
| Search/add voices | `GET /api/loan/voices/library`, `POST /api/loan/voices/add` | Voice library dialog |

Do not rename fields, change status codes, add required request fields, freeze agent settings into links, or expose new server data. Derived metrics, filters, readiness, elapsed time, profile completeness, and UI-only sync state are client computations.

## Input validation

Client validation gives immediate feedback; the existing server sanitizers and provider validation remain authoritative.

| Input | Rule and failure behavior |
|---|---|
| Rehearsal customer name | Required string, normalize whitespace, strip `{ } < >`, 1–40 characters. Inline error; no session request. |
| Rehearsal phone | Optional string, same plain-text normalization, max 20; `inputMode="tel"`. Do not invent E.164 validation. |
| Link customer name | Required string, same normalization, 1–40. Inline error; keep dialog values. |
| Link phone / note | Phone optional max 20; note optional max 200. Note is operator-only and server strips control characters. |
| Link expiry | Required enum `7`, `30`, `never`, mapped to `7`, `30`, `null`. Unknown UI value resets to 7. |
| Company / agent / partner banks | Required normalized single-line strings, 1–80. Inline field errors and focus first invalid field. |
| Regulatory claim | Optional normalized single-line string, max 80. |
| Model | Must be selected from the loaded catalog. Server model regex/availability and `normaliseLlm` remain authoritative. |
| Reasoning / temperature | Reasoning must be supported by selected model; temperature number 0–1 in 0.05 UI steps. |
| Voice ID | Required `[A-Za-z0-9]{10,40}` and preferably present in account voices; missing voice blocks calls but remains visible for correction. |
| Voice tuning | Speed 0.7–1.2 in 0.05 steps; stability/similarity 0–1 in 0.05 steps. |
| Language / TTS | Language `hi` or `en`; TTS must be one of `TTS_MODELS[language]`; Hinglish is boolean and relevant only for Hindi. |
| Opening line / prompt | Optional; max 500 / 50,000; normalize line endings. Placeholders limited to `customer_name`, `customer_phone`, and `system__*`. Unknown placeholder blocks save. |
| Call timing | Timeout integer 1–30; eagerness `patient|normal|eager`; silence hang-up one of `0,15,30,60,120,300`; max duration one of `3,5,10,15,20,30`. |
| ElevenLabs API key | Required password string matching existing 20–200 character key pattern. Never trim into visible state after successful save and never log. |
| Voice search | Search optional max 80; language `hi|en-in|en|all`; gender allowed values; use case `conversational|any`; page clamped 0–50 by server. |
| Public token | Server-owned path validation: 20–24 base64url characters. 400 invalid, 404 unknown, 410 revoked/expired. |
| Public acknowledgement | Required client boolean before Start; session-only, not sent or represented as audited consent. |

## Error handling and recovery

- **Console bootstrap:** network/non-2xx `/api/loan` is fatal to page content. Keep shell/navigation, show sanitized message and Retry. Do not log customer data in the browser. Unexpected server/render failures use route `error.js`; Next server logging is sufficient.
- **Options/catalog:** recoverable. Preserve saved model/voice, show each `llmsError` or `voicesError` next to its control, and offer Retry. Subscription `null` is “Usage unavailable,” never zero. Expected partial failures are not client-logged.
- **Settings save:** 400 means invalid placeholders/model and is recoverable by editing; 422 means provider rejected configuration and remains dirty; network/5xx retains all edits and offers Retry. A 200 with `warning` means settings were saved locally but remote sync is pending; show an amber persistent status and let Save & sync retry the same PUT. Existing `[loan] agent sync failed` server error logging remains; validation 4xx is not logged.
- **Key change:** 400 is invalid/rejected and requires editing the key; 502/timeout is recoverable with the value retained only in the password input. Never show or log the submitted key. A failed fallback delete leaves current UI status unchanged and offers Retry.
- **Voice preview:** missing URL disables preview. Audio rejection/failure changes that row to “Preview unavailable—try again”; it does not affect selection and is not server-logged.
- **Voice library:** search 502 retains previous results and offers Retry. Add 422 shows the provider’s actionable limit/permission message on that row; 502 allows retry. Do not select a voice until add succeeds.
- **Rehearsal/public start:** `NotAllowedError` gives browser permission instructions; `NotFoundError` says no microphone was found; `NotReadableError` says another app may be using it. Session 502/provider errors retain inputs and allow retry. SDK connection errors appear in the stage, not a transient toast. Existing session route failures remain server error logs without PII.
- **Call registration:** recoverable and non-blocking. Operator rehearsal shows a warning if registration fails; public flow remains silent. Do not end a connected call because logging failed.
- **Call polling:** transient fetch failures leave the last call state and continue on the next interval. At three minutes stop local polling and show a delayed-processing message. Server-side missing-conversation behavior remains authoritative at 15 minutes. Existing refresh failures are logged server-side at error level.
- **Call removal:** failure keeps the row and dialog open with Retry. Success removes only local state after the API confirms.
- **Links load/create/revoke:** load failure retains last good data. Create failure preserves form values. Revoke 404 means stale state; refresh the list and say the link is already unavailable. Other failures keep status unchanged and offer Retry. Expected validation/404 is not logged.
- **Clipboard:** failure selects the read-only URL/JSON and shows manual-copy guidance. It is recoverable and not logged.
- **Public bootstrap:** invalid, not found, expired, and revoked are terminal for that link; upstream/5xx is recoverable and gets a generic Retry state. Do not expose provider messages. Public session 410 after initial load transitions to the matching terminal link state.
- **Unexpected customer-page failure:** use a dedicated error boundary with “We couldn’t open this voice session” and Retry. Never render stack traces, token values, customer phone, or provider identifiers.

## Invariants and ownership

- **Accepted settings equal running settings:** `PUT /api/loan` and `lib/loan/agent.js` own provider validation/sync; the form owns only optimistic validation and dirty state.
- **Secrets stay server-side:** `lib/loan/settings.js` and API routes own key storage/redaction. Components receive only `keyStatus`.
- **Public response is minimal:** `/api/loan/links/[token]/public` owns redaction. Public components must not fetch operator APIs.
- **Link usability:** `lib/loan/shareLinks.js` owns token shape, expiry, revoke, and current-settings behavior. The client displays returned status rather than recomputing authority for session access.
- **Progress never moves backward:** `useLoanCall` owns monotonic progress and ignores unknown tool steps. Visual components are pure renderers.
- **Sensitive extraction is masked:** `lib/loan/analysis.js` owns PAN masking and normalized results. No component handles a full PAN.
- **One call action at a time:** `useLoanCall` and rehearsal/public controls own disabling start/end while connecting or ending.
- **DNC is not a score:** the analysis result owns DNC; UI prioritizes it and offers no follow-up action.
- **No false compliance claim:** copy/component layer owns terminology, using “Conversation policy check” and explanatory text everywhere.
- **Customer simplicity:** the public component owns withholding transcript, technical status, and extracted profile even though operator rehearsal can show them.

## Concrete component and file plan

### Route and shell files

- **Add** `app/loan/layout.js`: import `loan.css`, return children only.
- **Add** `app/loan/loan.css`: scoped console/public tokens, safe-area helpers, reduced-motion live bars; no gradient utilities.
- **Replace/move** `app/loan/page.js` with `app/loan/(console)/page.js`.
- **Add** `app/loan/(console)/layout.js`, `calls/page.js`, `links/page.js`, `rehearsal/page.js`, `agent/page.js`, plus `loading.js` and `error.js`.
- **Modify** `components/dashboard-shell.jsx`: bypass all `/loan` paths.
- **Modify** `components/top-loader.jsx`: hide for public call; use restrained loan styling for operator routes.
- **Modify** `app/loan/call/[token]/page.js`: preserve generic metadata and existing API fetch, but distinguish 5xx/service failure from invalid token and catch fetch exceptions.

### Shared console components

- **Add** `app/components/loan/console/LoanShell.jsx`, `LoanNavigation.jsx`, `LoanTopBar.jsx`, and `LoanConsoleProvider.jsx`.
- **Add** `app/components/loan/ui/` primitives: `Button`, `Field`, `StatusBadge`, `InlineAlert`, `Dialog`, `Drawer`, `Skeleton`, and `EmptyState`. They use scoped semantic tokens and native HTML; no new package.
- **Add** `lib/loan/consoleMetrics.js`: pure period filtering, KPI calculations, attention priority, outcome counts, and profile completeness. Keeping these pure makes analytics deterministic and unit-testable.

### Page components

- **Add** `app/components/loan/overview/LoanOverview.jsx`, `ReadinessStrip.jsx`, `MetricRow.jsx`, and `OutcomeBars.jsx`.
- **Refactor** `LoanResults.jsx` into `calls/CallTable.jsx`, `CallList.jsx`, `CallDetailDrawer.jsx`, `BorrowerProfile.jsx`, and `ConversationPolicy.jsx`. Reuse the existing value formatting but remove card-per-call layout.
- **Refactor** `LoanCall.jsx` into `rehearsal/RehearsalStudio.jsx`, `ScenarioSetup.jsx`, `ConversationMonitor.jsx`, and `CallStatusRail.jsx`. Continue wrapping only this interactive surface in `ConversationProvider`.
- **Refactor** `LoanLinks.jsx` into `links/ShareLinksManager.jsx`, `CreateLinkDialog.jsx`, and `LinkTable.jsx`.
- **Refactor** `LoanConfig.jsx` into `agent/AgentEditor.jsx` and six section components. Keep one form owner and one save path.
- **Retain/refine** `VoicePicker.jsx`, `VoiceLibrary.jsx`, and `AccountPanel.jsx` behind the new Agent sections; move library browsing into the shared accessible dialog.
- **Rewrite** `PublicCallPage.jsx` around Ready, Connecting/Live, Ended, and Unavailable states. Keep `ConversationProvider`, `useLoanCall`, existing dynamic variables, and fire-and-forget call registration.
- **Extend** `ProgressChecklist.jsx` with explicit `variant="operator" | "public"`: operator renders the full list; public renders segmented progress plus current stage. It receives the same progress object and performs no business logic.
- **Retire** `LoanWorkspace.jsx` and `LoanSetupSummary.jsx` after route parity; they should not remain as the new page wrapper.

### Domain and API files

Keep `lib/loan/agent.js`, `analysis.js`, `calls.js`, `catalog.js`, `elevenlabs.js`, `options.js`, `progress.js`, `prompt.js`, `settings.js`, `shareLinks.js`, and all `app/api/loan/**` response contracts intact. `useLoanCall.js` may receive only additive friendly mappings for `NotFoundError`/`NotReadableError`; its start/session/progress behavior remains the shared source for operator and public calls.

## Testability and validation

Pure unit tests should cover period filtering, qualification-rate zero denominators, attention deduplication/priority, profile completeness, readiness states, all client validation boundaries, link expiry mapping, and responsive data-view formatting. Existing pure modules should retain tests for settings sanitization, placeholder detection, TTS swapping, monotonic progress, PAN masking, outcome fallback, link usability, and token/ID validation.

React Testing Library tests should cover navigation active state; bootstrap/partial options errors; dirty save bar and restore confirmation; model-to-reasoning reset; missing voice; exclusive preview behavior; link create/copy fallback/revoke; calls filters and drawer; rehearsal idle/connecting/live/processing states; public acknowledgement gating; public progress without transcript; and every link-unavailable state. Mock `fetch`, media APIs, and the ElevenLabs hook boundary rather than making provider calls in unit tests.

Route integration tests should invoke existing handlers with valid/invalid payloads and a temporary store to verify status codes and redaction. In particular, assert that the public route never returns note/call IDs/revocation details/API key, save warnings remain 200, unknown placeholders remain 400, rejected agent config remains 422, and expired/revoked sessions remain 410.

Playwright should test keyboard/focus behavior, new route navigation, desktop/mobile layouts, modal/drawer focus restoration, copy fallback, customer ready/live/ended rendering with mocked APIs, and absence of console chrome/PII metadata on `/loan/call/[token]`. Use Chromium fake media devices for UI state coverage. A real ElevenLabs smoke test remains manual or an explicitly credentialed integration job: select an OpenAI model, preview/add a voice, save/sync, start and end one rehearsal, observe progress/transcript, and confirm the processed result appears.

Implementation validation is complete only after `npm run build`, automated tests, axe/browser accessibility checks on representative routes, and visual checks at 320, 390, 768, 1024, and 1440 px. Confirm the standalone output does not include test tooling and that no new runtime dependency was added.

## Design acceptance checks

1. `/loan` through `/loan/agent` render a dedicated Arvo Lending shell and never show the support-agent sidebar, emerald styling, or support workspace status.
2. Every primary console destination has a stable URL and remains usable after direct load/refresh; `/loan/call/[token]` remains outside console chrome.
3. Overview values are derived only from retained call/link payloads, handle empty denominators, and never show fabricated trends or eligibility metrics.
4. A rehearsal uses the existing session, registration, progress, transcript, and polling APIs and exposes recoverable microphone/provider failures without losing scenario input.
5. Operators can create, copy/open, filter, and revoke links; the UI explicitly states that active links use current agent settings and that revoke retains past calls.
6. Every setting currently represented by `DEFAULT_SETTINGS`, plus ElevenLabs account switching and voice-library selection, remains configurable from Agent without a code edit.
7. Save remains explicit; invalid values do not issue PUT, 200 warnings are visibly distinct from synced success, and dirty edits survive failed requests.
8. The public page discloses automation and safety, requires acknowledgement, visualizes progress without transcript or sensitive profile data, and has truthful ready/live/ended/unavailable states.
9. DNC, human-review, and conversation-policy states are distinct; PAN stays masked; deletion and compliance wording do not overclaim.
10. Keyboard, reduced-motion, contrast, safe-area, and responsive behaviors meet the specifications above, and existing `/api/loan/**` request/response behavior is unchanged.

## Out of scope / follow-on platform work

Direct OpenAI credentials or a provider abstraction outside ElevenLabs; outbound PSTN dialling; SMS/WhatsApp/email delivery; CRM synchronization; authentication, SSO, roles, and multi-tenancy; database migration; encrypted secret management; immutable audit logs; persisted consent evidence; configurable logos/colors/legal URLs; provider-record deletion and retention controls; legal or regulatory certification; configurable extraction schema; custom analytics APIs; bulk link/call operations; multilingual UI beyond the current Hindi/English agent behavior; and commercial billing are not part of this frontend redesign. They should be described as roadmap items, never implied by the buyer-demo UI.