# Loan Advisor Implementation Audit

## Audit status

This is a read-only implementation audit of the current loan-advisor implementation. No application source files were changed. The audit covered `app/loan`, every file under `app/components/loan`, every route under `app/api/loan`, every module under `lib/loan`, the root layout, dashboard shell, global styles, Tailwind/PostCSS setup, shared primitives used by the loan UI, and the project build configuration.

Baseline findings:

- `npm run build` passes on the current worktree with Next.js 15.5.19. The build includes `/loan`, `/loan/call/[token]`, and all twelve loan API route handlers.
- `package.json` has only `dev`, `build`, and `start` scripts. There is no repository test, lint, Vitest/Jest, Playwright, or Cypress command; `next build` is currently the only automated compile/type/lint gate.
- `next.config.js` uses `output: 'standalone'`, which must be preserved for the Raspberry Pi deployment.
- The root README was reviewed. There is no project-level `AGENTS.md`, `CONTRIBUTING.md`, or `.kiro/steering/*`; similarly named files only exist inside dependencies and do not govern this repository.
- The worktree is already dirty on `master`. In particular, `app/api/loan`, `app/components/loan`, `app/loan`, and `lib/loan` are currently untracked, while `components/dashboard-shell.jsx`, `components/top-loader.jsx`, and `next.config.js` have local modifications. An implementer must preserve these existing changes and must not use destructive Git cleanup/reset commands.

## Executive conclusion

A full visual rebuild is feasible without changing the working loan backend. The safe boundary is to retain all API routes, persistence, settings sanitisation, ElevenLabs synchronization, call-analysis logic, public-token validation, and the shared `useLoanCall` hook, while replacing the rendered operator and public-client surfaces around those contracts.

The operator `/loan` route is not standalone today: `app/layout.js` always places it inside `DashboardShell`, whose header also constrains content to `max-w-5xl`. The least risky isolation is a narrow pathname bypass in `DashboardShell` (matching `/loan` and `/loan/*`), paired with the same bypass in `TopLoader`, and a new scoped `app/loan/layout.js` visual root. Moving the rest of the application into route groups would be a much broader and unnecessary migration.

The rebuild should use the existing Tailwind/Lucide stack and add no UI dependency. This keeps the standalone build lightweight for the Pi, avoids dependency churn, and is sufficient for a polished B2B fintech interface. Route-scoped CSS variables in a CSS module can establish a cool slate/navy/cobalt loan identity without changing the warm emerald tokens used by the rest of Arvo.

## Current architecture and ownership

### Render and shell hierarchy

1. `app/layout.js` owns the HTML/body, Inter font variable, global theme bootstrap, `TopLoader`, and `DashboardShell`.
2. `components/dashboard-shell.jsx` owns the Arvo sidebar, route title/header, theme control, `max-w-5xl` main container, and mobile drawer. It currently bypasses itself only for paths beginning `/loan/call/`.
3. `app/loan/page.js` is a server page that adds the shared `PageHeader` and renders client component `LoanWorkspace`.
4. `app/loan/call/[token]/page.js` is the public server boundary. It resolves token data through `/api/loan/links/[token]/public`, emits generic metadata that excludes customer information, and renders either `PublicCallPage` or `LinkUnavailable`.
5. `app/components/loan/LoanWorkspace.jsx` owns the operator application's orchestration state and renders three query-addressable tabs: `call`, `links`, and `config`.

### Operator workspace state

`LoanWorkspace` is the single important state owner and should remain so during the visual migration:

- `data`: `{ settings, defaults, agent, calls }` from `GET /api/loan`.
- `options`: account key status, LLMs, voices, and subscription from `GET /api/loan/options`.
- `activeLinkCount`: independently derived from `GET /api/loan/links`.
- `tab`: one of `call`, `links`, or `config`; `?tab=links` and `?tab=config` are supported bookmarks, while the call tab removes the query parameter.
- `polling`: a `Set` of conversation IDs, ensuring one polling loop per call.
- `mounted`: stops polling after unmount.
- Load/error state: initial settings/calls load is fatal to the workspace; options and link-count failures degrade independently.

Call lifecycle behavior that must survive a markup rewrite:

- Initial load resumes up to five non-final calls left in `in_progress` or `processing` state.
- A tracked call is fetched from `GET /api/loan/calls/[id]` every 3 seconds for up to 3 minutes.
- `mergeCall(call)` prepends a new call or shallow-merges an existing record by ID.
- `onCallStarted(id, customerName)` registers the conversation with `POST /api/loan/calls`.
- `onCallEnded(id)` immediately marks a non-final local call `processing`, begins polling, and refreshes options/credits after 5 seconds.
- `removeCall(id)` calls `DELETE /api/loan/calls/[id]` and removes the local item.
- `PreviewProvider` wraps the whole workspace so only one voice preview can play at a time, including the setup summary and voice library.

`LoanLinks` currently owns its own link list and creation/revocation state. This causes an existing minor staleness issue: the KPI's separate `activeLinkCount` does not refresh when a link is created or revoked until the workspace reloads. The visual rebuild may add a UI-only `onLinksChanged(activeCount)` callback to synchronize that derived count; it does not require an API change.

### Component contracts and callback signatures

These signatures are internal contracts even if their markup is replaced:

| Component/hook | Inputs | Outputs/callbacks that must be preserved |
| --- | --- | --- |
| `LoanCall` | `agentName`, `disabled`, `onCallStarted`, `onCallEnded` | Calls `onCallStarted(conversationId, cleanedCustomerName)` and `onCallEnded(conversationId)`; must render inside one `ConversationProvider`. |
| `useLoanCall` | `{ sessionUrl, dynamicVariables, onCallStarted?, onCallEnded? }` | Returns `{ status, isSpeaking, turns, progress, error, start, stop }`; callback signatures are `onCallStarted(conversationId)` and `onCallEnded(conversationId)`. |
| `LoanResults` | `calls`, `onRemove` | Calls `onRemove(callId)` and awaits it while showing removal state. |
| `LoanSetupSummary` | `settings`, `options`, `onEdit` | Calls `onEdit()` to switch to configuration; consumes shared preview context. |
| `LoanConfig` | `saved`, `defaults`, `options`, `onSaved`, `onOptionsReload`, `onKeyChanged` | Calls `onSaved(nextSanitisedSettings)`, awaits `onOptionsReload()` after a voice is added, and awaits `onKeyChanged()` after account-key changes. |
| `AccountPanel` | `keyInfo`, `subscription`, `onChanged` | Calls/awaits `onChanged()` after PUT/DELETE of the dashboard key. |
| `VoicePicker` | `value`, `onChange`, `voices`, `voicesError`, `tier`, `language`, `onVoicesChanged` | Calls `onChange(voiceId)`; awaits `onVoicesChanged()` after adding a library voice. |
| `VoiceLibrary` | `accountIds`, `selectedId`, `tier`, `defaultLanguage`, `onUse`, `onAdded` | Calls `onUse(voiceId)` for an existing account voice and `onAdded(voiceId)` after copying a library voice. |
| `ProgressChecklist` | `progress`, optional `className` | Presentation-only; accepts the progress shape below and has no callback. |
| `PublicCallPage` | `token`, `customerName`, `customerPhone`, `companyName`, `agentName` | Starts the token-specific session, registers the call with `linkToken`, and changes to its completed state on disconnect. |

`useLoanCall` status is intentionally normalized to `idle | connecting | connected | ending`; the ElevenLabs SDK's transient disconnecting state is not exposed. `turns` entries are `{ who: 'customer' | 'agent', text }`. Progress is:

```js
{
  currentStepId: string | null,
  currentStepIndex: number,
  completedStepIds: string[],
  highlights: Record<string, string>
}
```

The progress handler only moves forward, ignores invalid/hallucinated step IDs, truncates highlights to 80 characters, and catches tool-handler failures so cosmetic progress cannot break a call.

## Configuration contract

`lib/loan/options.js` is the shared client/server source of truth. A rebuilt form must round-trip every key in `DEFAULT_SETTINGS`; omitting a control would make the dashboard less configurable even though the API still accepts it.

| Group | Keys and validation |
| --- | --- |
| Persona | `companyName`, `agentName`, `partnerBanks`: required non-empty sanitized single lines, max 80; `regulatorLine`: sanitized max 80 and may be blank. |
| Intelligence | `llm`: provider model ID; `reasoningEffort`: `''` or supported fixed effort; `temperature`: 0–1. |
| Voice | `voiceId`: 10–40 alphanumeric characters; `ttsModel`: normalized against language; `speed`: 0.7–1.2; `stability` and `similarityBoost`: 0–1. |
| Language/script | `language`: `hi` or `en`; `hinglishMode`: boolean; `firstMessage`: one line, max 500; `prompt`: max 50,000. |
| Call behavior | `turnTimeout`: integer 1–30; `turnEagerness`: `patient | normal | eager`; `silenceHangup`: `0 | 15 | 30 | 60 | 120 | 300`; `maxCallMinutes`: `3 | 5 | 10 | 15 | 20 | 30`. |

Only `{{customer_name}}`, `{{customer_phone}}`, and ElevenLabs `{{system__...}}` placeholders are accepted. Unknown placeholders produce HTTP 400 and must remain visibly actionable in the form.

A blank `firstMessage` or `prompt` intentionally means “use the generated default”; it is not missing data. `LoanConfig` currently keeps edits local until “Save & sync,” computes dirty state with `settingsEqual`, resets when `saved` changes, and uses the server-returned sanitized object after save. Those semantics must be preserved.

The dashboard is configurable for the runtime persona, model, voice, language/script, and call timing, but not literally every agent property. The data-collection schema and compliance evaluation are hardcoded in `lib/loan/analysis.js`; the `end_call` and `update_progress` tools are hardcoded in `lib/loan/agent.js`/`progress.js`; and the dynamic variable names are fixed. Exposing those would be a separate backend/product feature, not part of a safe UI-only rebuild.

### OpenAI scope clarification

The existing intelligence picker already discovers GPT/OpenAI, Gemini/Google, Claude/Anthropic, and other models from the current ElevenLabs account. OpenAI models still run through ElevenLabs; there is no `OPENAI_API_KEY`, direct OpenAI transport, or custom-LLM configuration in this repository. The rebuild should present provider grouping clearly but must not imply that a separately billed direct OpenAI connection exists. Adding one would require a new server contract and is outside this migration.

## HTTP contracts that the UI must retain

### Workspace and settings

- `GET /api/loan` → `{ settings, defaults, agent: { id, key }, calls }`.
- `PUT /api/loan` accepts any settings subset, sanitizes against stored settings, validates placeholders/model support, syncs ElevenLabs before persistence when possible, and returns `{ ok: true, settings, agentId? }` or `{ ok: true, settings, warning }`.
- HTTP 400 represents invalid placeholders/model selection; HTTP 422 represents an ElevenLabs-rejected agent configuration. No-key, bad-key, network, and some sync failures can still return HTTP 200 with a warning after local save. The UI must therefore render `warning` even when `res.ok` is true.

### Account options and key

- `GET /api/loan/options` → `{ key, llms, llmsError?, voices, voicesError?, subscription }`. Individual resource failures are independent. With no key, it returns HTTP 200 with null resources and an `error` string.
- `key` is public status only: `{ configured, source, last4, envAvailable }`. The actual API key is never returned.
- `PUT /api/loan/key` body `{ apiKey }` validates the candidate against ElevenLabs before storing it; response is `{ ok: true, key }`.
- `DELETE /api/loan/key` removes the dashboard override and falls back to `.env.local`; response is `{ ok: true, key }`.
- Dashboard keys are stored locally in gitignored `.agent.json`; the dashboard key takes precedence over `ELEVENLABS_API_KEY`.

### Voice catalog

- Account voices are `{ id, name, category, gender, age, accent, style, useCase, hindi, previewUrl }`.
- LLM options are `{ id, provider, efforts }`; changing a model should choose its first/fastest supported effort or clear effort when unsupported.
- `GET /api/loan/voices/library` accepts `search`, `language`, `gender`, `useCase`, and `page`; response is `{ hasMore, total, voices }`.
- `POST /api/loan/voices/add` body is `{ publicOwnerId, voiceId, name }`; success returns `{ ok, voiceId, voice }`.
- Voice previews rely on the single shared `PreviewProvider`; recreating one provider per row would permit overlapping audio.

### Call sessions and logging

- `POST /api/loan/session` → `{ agentId, conversationToken }` or HTTP 502 `{ error }`.
- The browser starts ElevenLabs with `connectionType: 'webrtc'` and dynamic variables `customer_name` and `customer_phone`.
- `POST /api/loan/calls` body is `{ conversationId, customerName, linkToken? }`; response is `{ call }`.
- `GET /api/loan/calls/[id]` returns `{ call }` and drives post-call polling; `DELETE` returns `{ ok: true }` and removes only the local log, not the ElevenLabs recording.
- Call IDs must match `conv_...`. Stored call status is `in_progress | processing | done | failed`.
- Completed calls may contain `result`, `summary`, `title`, `compliance`, and `durationSecs`. The UI must tolerate `done` with no `result` for calls too short to analyze.
- The result object includes name, phone, city, residence/property, purpose, amount, age, employment/income/company, EMIs, CIBIL details, masked PAN, callback time, DNC/outcome/sentiment, notes, and review flag. PAN is already masked server-side and must never be reconstructed or solicited in the dashboard UI.

### Share links and public tokens

- `GET /api/loan/links` returns dashboard records containing `token`, customer fields, operator-only `note`, dates, `revoked`, computed `status`, `callCount`, and relative `url`.
- `POST /api/loan/links` body is `{ customerName, customerPhone?, note?, expiresInDays? }`; `null` expiry means never, omitted means 7 days, and numeric values clamp to 1–30. Response is `{ ok, link, url }`.
- `DELETE /api/loan/links/[token]` revokes rather than deletes, preserving historical call associations.
- Public tokens are 22-character cryptographically random base64url values accepted by `TOKEN_RE` at 20–24 characters. Do not shorten them, put them in query strings, or replace them with client-generated IDs.
- `GET /api/loan/links/[token]/public` deliberately exposes only `{ customerName, customerPhone, companyName, agentName }`. It must never expose note, call IDs, revocation/expiry internals, or the token in its response.
- `POST /api/loan/links/[token]/session` revalidates token shape, existence, expiry, and revocation immediately before minting a WebRTC token. UI-side validation is not a substitute.
- Public calls register through the same `POST /api/loan/calls`, adding `linkToken`. The current registration is fire-and-forget so it never blocks the voice connection.
- A link always points at the current live settings and agent at call time; it is not a configuration snapshot. The rebuilt UI should explain this rather than imply a frozen campaign version.
- Public page metadata is intentionally generic and contains no customer name. Preserve that privacy property.

## Server and domain behavior to keep unchanged

For a UI/UX rebuild, these files should remain untouched:

- `app/api/loan/route.js`
- `app/api/loan/options/route.js`
- `app/api/loan/key/route.js`
- `app/api/loan/session/route.js`
- `app/api/loan/calls/route.js`
- `app/api/loan/calls/[id]/route.js`
- `app/api/loan/links/route.js`
- `app/api/loan/links/[token]/route.js`
- `app/api/loan/links/[token]/public/route.js`
- `app/api/loan/links/[token]/session/route.js`
- `app/api/loan/voices/library/route.js`
- `app/api/loan/voices/add/route.js`
- `lib/loan/settings.js`
- `lib/loan/agent.js`
- `lib/loan/elevenlabs.js`
- `lib/loan/catalog.js`
- `lib/loan/calls.js`
- `lib/loan/shareLinks.js`
- `lib/loan/analysis.js`
- `lib/loan/options.js`
- `lib/loan/prompt.js`
- `lib/loan/progress.js`
- `lib/loan/useLoanCall.js`
- `lib/store.js`
- `app/loan/call/[token]/page.js`
- `app/layout.js`
- `tailwind.config.js`
- `postcss.config.js`
- `next.config.js`

Why: these files own security boundaries, validation, provider payloads, persistence, public-data minimization, resumable call logging, and Pi deployment output. None needs to change to deliver the requested visual rebuild.

## Files that can be visually replaced

These are presentation files and can be rewritten, provided the contracts above remain intact:

- `app/loan/page.js` — remove the shared `PageHeader`; retain route metadata and render the standalone workspace.
- `app/components/loan/LoanWorkspace.jsx` — replace the render tree, but preserve its fetch/poll/merge/tab behavior and callbacks.
- `app/components/loan/controls.jsx` — replace the loan-only component styling while retaining control behavior, refs, accessible labels, and shared preview player.
- `app/components/loan/LoanCall.jsx`
- `app/components/loan/LoanSetupSummary.jsx`
- `app/components/loan/LoanResults.jsx`
- `app/components/loan/LoanConfig.jsx`
- `app/components/loan/AccountPanel.jsx`
- `app/components/loan/VoicePicker.jsx`
- `app/components/loan/VoiceLibrary.jsx`
- `app/components/loan/LoanLinks.jsx`
- `app/components/loan/ProgressChecklist.jsx`
- `app/components/loan/PublicCallPage.jsx`

New presentation files recommended:

- `app/loan/layout.js` — route-scoped loan visual root for both operator and public pages.
- `app/loan/loan.module.css` — scoped loan color/surface variables and only the bespoke animation/layout rules utilities cannot express cleanly.
- `app/components/loan/LoanAppShell.jsx` — dedicated operator header/navigation/mobile shell; no data fetching.

Files requiring only narrow integration edits, not replacement:

- `components/dashboard-shell.jsx` — change the existing public-call bypass to an `isLoanSurface` check matching `pathname === '/loan' || pathname.startsWith('/loan/')`.
- `components/top-loader.jsx` — use the same `isLoanSurface` condition so the emerald Arvo loader does not leak into either standalone loan surface.

`app/globals.css` and `tailwind.config.js` do not need changes. Tailwind already scans `app/**/*.{js,jsx}`, `components/**/*.{js,jsx}`, and `lib/**/*.{js,jsx}`. The global semantic tokens may continue serving the rest of Arvo; loan-specific tokens should be scoped under the new loan layout instead of globally reassigning `--primary`, `--background`, or body styles.

## Reusable logic and patterns

- Keep `useLoanCall` as the only call mechanics implementation. Duplicating SDK setup in redesigned components would risk mismatched callbacks, leaked microphones, or one surface losing the progress client tool.
- Keep `options.js` imported by both form and server. Duplicating enum/range values in a new UI would create selections the server silently normalizes or rejects.
- Keep `defaultPrompt`/`defaultFirstMessage` for generated previews. Blank custom fields must retain generated-default semantics.
- Keep `ProgressChecklist` driven by `PROGRESS_STEPS`; the UI may change, but labels/order should not be copied into a second array.
- Keep `cn` from `lib/utils.js` and Lucide icons. Existing `Card`/`Field` primitives are optional: the new standalone UI may stop using them where their warm dashboard styling is limiting.
- Keep native form controls and the existing accessible wiring patterns (`htmlFor`, `aria-describedby`, `role="switch"`, `aria-live`, reduced-motion handling). A visual rewrite should improve rather than discard them.

## Risk and coupling register

### High risk

1. **Workspace polling hidden inside a visual component.** Replacing `LoanWorkspace` wholesale can easily drop resumed polling, final-state detection, the three-minute limit, or delayed credit refresh. Preserve the behavior block and replace its presentation incrementally.
2. **Conversation provider/hook coupling.** Both operator and public call surfaces need exactly one `ConversationProvider` above `useLoanCall`. Moving the hook outside it fails at runtime even though static build may pass.
3. **Public-token privacy.** The public server page and public API intentionally minimize fields and metadata. Do not fetch the operator links endpoint from the public page or embed the full link object into client props.
4. **Settings completeness.** The server accepts 20 setting keys. A cleaner form that omits “advanced” controls without an accessible advanced section would regress the user's requirement that configuration not require code edits.
5. **Save warnings on HTTP 200.** Treating all successful status codes as fully synced would hide no-key/provider sync warnings and mislead operators.
6. **Existing untracked implementation.** Since the entire loan feature is untracked, destructive cleanup or a review based only on `git diff` can erase/miss it. Stage explicit files only if committing later.

### Medium risk

1. **Two independent link fetches.** KPI count can become stale after create/revoke; synchronize via a callback or a shared lifted link state without changing the endpoint.
2. **Global brand leakage.** Dashboard shell width/header and emerald `TopLoader` remain unless both path checks are changed. A nested layout alone cannot remove an ancestor wrapper.
3. **CSS token leakage.** Overriding root semantic variables for the loan look would restyle all routes. Scope new variables to the loan layout class.
4. **Provider availability is dynamic.** Do not hardcode a static GPT/Claude/Gemini list; use `options.llms`, preserve unavailable-current-model handling, and preserve reasoning-effort normalization.
5. **Voice account switching.** Voices belong to the selected ElevenLabs account. The warning for a missing selected voice and options reload after switching keys must remain prominent.
6. **Public registration is best effort.** Do not await the call-log POST before starting/showing the call; logging failure must not take down a customer conversation.
7. **Call result fields are sparse.** Results must gracefully render missing/zero values, a final call with no analysis, provider failure, and compliance without rationale.

### Existing platform limitations (do not silently expand scope)

- Dashboard/API routes have no authentication; public links rely on token secrecy. Authentication is a separate platform feature.
- `.agent.json` is plaintext, file-based, and uses read/merge/write without locking. It is suitable for the current single-user MVP but not multi-tenant concurrency.
- A dashboard API key is locally persisted in plaintext, though gitignored and never returned to the browser.
- No automated browser or unit tests exist. External ElevenLabs behavior cannot be proven by `next build` alone.
- Public-link calls are only actively polled when an operator later opens the workspace; the initial load resumes at most five non-final records.

## Chosen UX direction

1. **Standalone loan product shell.** Use a dedicated cool-slate/navy B2B finance shell with a compact desktop rail, mobile top navigation, a restrained cobalt action color, clear status hierarchy, and an explicit route back to Arvo. This makes `/loan` presentation-ready without pretending it is a separately deployed application.
2. **Keep the current information architecture and URLs.** Retain the `call`, `links`, and `config` tab IDs/query parameters, relabeling them visually as an operations overview, client links, and agent studio. Existing bookmarks and callbacks continue to work.
3. **One state owner, presentation below it.** `LoanWorkspace` remains the data/polling coordinator; `LoanAppShell` is stateless presentation. This avoids a risky state-management rewrite while allowing all visible UI to be new.
4. **No fake dashboard data.** KPIs, readiness states, account credits, voice/model labels, and history must derive from existing responses. Do not add fabricated conversion graphs or loan-volume metrics just to fill the design.
5. **Progress, not technical transcript, for customers.** The public client page remains a three-state mobile journey (ready, live, complete) with a plain-language progress track and safety reassurance. It must not expose the transcript, analysis JSON, model/provider details, or operator note.
6. **No new dependency.** Tailwind, scoped CSS, Lucide, and existing React/ElevenLabs packages are enough. This keeps installation and standalone deployment light on the 1 GB Raspberry Pi.

# Implementation Plan

- [ ] 1. Isolate all `/loan` routes from Arvo's dashboard chrome and establish a scoped standalone visual root.
      Add `app/loan/layout.js` and `app/loan/loan.module.css` with a full-height scoped loan canvas and light/dark loan tokens. Replace the shared `PageHeader` wrapper in `app/loan/page.js`, and make narrow, shared `isLoanSurface` bypasses in `DashboardShell` and `TopLoader`; do not alter `app/layout.js` or global/Tailwind tokens.
      Files: `app/loan/layout.js`, `app/loan/loan.module.css`, `app/loan/page.js`, `components/dashboard-shell.jsx`, `components/top-loader.jsx`
      Verify: `npm run build` — all existing routes compile, including `/loan` and `/loan/call/[token]`. Then run `npm run dev`; `/` must still show the Arvo shell, while `/loan` and `/loan/call/not-a-valid-token` must show no Arvo sidebar/header, no emerald loader, and no constrained dashboard main container.

- [ ] 2. Build the standalone operator shell and recompose the workspace without moving state ownership.
      Create `LoanAppShell.jsx` with the loan brand/header, desktop and mobile section navigation, account/readiness indicators, and a route back to Arvo. Rebuild `LoanWorkspace`'s visible hierarchy into a responsive operations surface while preserving its initial fetches, `call|links|config` tab IDs, query-string behavior, polling set, merge logic, resumed calls, callbacks, loading/error states, `PreviewProvider`, and real-data KPI calculations.
      Files: `app/components/loan/LoanAppShell.jsx`, `app/components/loan/LoanWorkspace.jsx`
      Verify: `npm run build` — the client boundary and all tab panels compile. Then run `npm run dev` and visit `/loan`, `/loan?tab=links`, and `/loan?tab=config`; direct URLs must select the correct section, switching sections must update/remove `?tab` exactly as before, and reloading must retain the selected query-addressed section.

- [ ] 3. Rebuild the demo-call cockpit, live progress, setup summary, and call-history presentation around the unchanged call hook.
      Replace the visible layouts with a presentation-ready call workspace: clear customer inputs, one dominant call action, explicit connecting/listening/speaking/ending states, a readable live transcript for operators, a restrained progress timeline, setup readiness, and responsive result cards/table details. Keep input cleaning, dynamic-variable names, one `ConversationProvider`, `useLoanCall`, callback signatures, call-log registration, result field handling, masked-PAN notice, compliance states, JSON copy, and remove behavior unchanged.
      Files: `app/components/loan/LoanCall.jsx`, `app/components/loan/ProgressChecklist.jsx`, `app/components/loan/LoanSetupSummary.jsx`, `app/components/loan/LoanResults.jsx`
      Verify: `npm run build` — the unchanged hook/API imports compile. Then run `npm run dev` with a configured test key: start one demo call, confirm only one microphone permission flow occurs, verify status/transcript/progress update during the call, end it, confirm it becomes `processing` and then `done` or `failed`, reload `/loan`, and confirm the record remains and can be removed locally.

- [ ] 4. Rebuild the complete agent configuration as an “Agent studio” while retaining every setting and save semantic.
      Restyle the loan-only controls and reorganize all 20 settings into a clear section index and responsive panels for identity, intelligence, voice, script, behavior, and account. Preserve local dirty state, defaults/custom-prompt behavior, unknown-placeholder feedback, dynamic LLM grouping and reasoning options, language/TTS normalization, missing-voice warnings, one shared preview player, voice-library pagination/add flow, key status secrecy, credit display, and `onSaved`/reload/key-change callbacks.
      Files: `app/components/loan/controls.jsx`, `app/components/loan/LoanConfig.jsx`, `app/components/loan/AccountPanel.jsx`, `app/components/loan/VoicePicker.jsx`, `app/components/loan/VoiceLibrary.jsx`
      Verify: `npm run build` — all settings and catalog modules compile. Then run `npm run dev`: confirm all keys in `DEFAULT_SETTINGS` have controls; switch between an available GPT/OpenAI and another provider model and verify reasoning choices update; preview two voices and confirm the first stops; verify unknown placeholders block save visibly; save a valid edit and confirm the server-returned values remain after reload; switch/test an ElevenLabs key without ever rendering the full stored key.

- [ ] 5. Rebuild client-link creation and management, and synchronize its active count with the shell KPI.
      Replace `LoanLinks` with a polished create-and-share flow and responsive link register while retaining the exact create payload, relative public URL, absolute clipboard URL, operator-only note, 7/30/never expiry semantics, status/call count fields, confirmation before revoke, and revoke-not-delete behavior. Add a UI-only callback between `LoanLinks` and `LoanWorkspace` so successful load/create/revoke refreshes the displayed active-link count without adding an endpoint.
      Files: `app/components/loan/LoanLinks.jsx`, `app/components/loan/LoanWorkspace.jsx`
      Verify: `npm run build` — link UI and callback changes compile without API changes. Then run `npm run dev`: create 7-day, 30-day, and no-expiry links in test data; copied URLs must use the current origin and `/loan/call/<token>` path; the active KPI must update immediately; revoking must change status without deleting the row or its call count.

- [ ] 6. Rebuild the public customer call page as a premium, minimal mobile experience without changing its server/token boundary.
      Rewrite only `PublicCallPage`/`LinkUnavailable` presentation into calm ready, live, and completed states using configured company/agent names, microphone explanation, fraud-safety copy, accessible call controls, and the shared progress data. Preserve props, token-specific session URL, dynamic variables, fire-and-forget call registration with `linkToken`, one `ConversationProvider`, no transcript/technical details, and generic error/link-unavailable copy; leave `app/loan/call/[token]/page.js` and all public APIs untouched.
      Files: `app/components/loan/PublicCallPage.jsx`
      Verify: `npm run build` — the dynamic public page remains in the route manifest. Then run `npm run dev`: an active link must render without any operator/dashboard chrome at narrow and wide widths, start and end a call, and appear in the operator call log/link count; revoked and expired links must show distinct non-technical states; malformed/unknown tokens must show the generic invalid state; page title/metadata must not contain a customer name.

## Final regression gate

After all six items, run `npm run build` and require a clean successful Next production build. Because the repository has no automated test suite, also run `npm run dev` and complete this manual matrix before considering the rebuild done:

- `/`, `/agent`, and another non-loan route retain their existing Arvo shell and theme.
- `/loan` is visually standalone at approximately 360 px, 768 px, and 1440 px widths; all primary actions are keyboard reachable, focus is visible, touch targets are usable, and reduced-motion preferences do not hide state.
- No-key state can still save locally and displays the HTTP-200 warning; configured-key state loads models, voices, subscription, and readiness independently.
- Saving/reloading preserves all settings, including blank-generated prompt semantics and custom prompt text.
- Demo and public calls both use WebRTC, show progress, register exactly one call ID, and do not expose the ElevenLabs key.
- Calls survive reload, resume processing, render sparse/failed/too-short outcomes safely, show masked PAN only, and delete only from the local log.
- Share links copy correctly, use current agent settings at call time, remain in history after revoke, reject revoked/expired/invalid public sessions, and never expose operator notes on the public surface.
- No API route or `lib/loan` file is changed in the UI rebuild diff.
