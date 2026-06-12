# Arvo — Product Plan

How Arvo grows from a working single-workspace prototype into multi-company software.
Two tracks are planned here: **Authentication / multi-tenancy** and an **effortless company-data connector**.
(Deployment is deliberately out of scope for now.)

---

## 0. Where we are

- Multi-page Next.js app (Overview · Agent · Knowledge base · Test call · Settings) on a shadcn/ui design system.
- One agent, persisted in `.agent.json` via `lib/store.js`. ElevenLabs is the hidden engine (key server-side only).
- Live data tools (`app/api/tools/*`) exist but use `lib/mocks.js` and aren't wired to the agent yet.

The two tracks below are what turn this into a product clients log into.

---

## 1. Authentication & multi-tenancy

**Goal:** each client company is a **workspace (tenant)**. People log in, only see their workspace, and data is isolated. Our ElevenLabs key stays ours (shared platform key, usage metered per workspace) — clients never get it.

### Data model (the spine)
```
Tenant      id, name, plan, createdAt
User        id, email, name
Membership  userId, tenantId, role(owner|admin|member)
Agent       id, tenantId, elevenLabsAgentId, config(json)      // replaces .agent.json
Document    id, tenantId, name, elevenLabsDocId                 // knowledge base
Connector   id, tenantId, type, name, config(json, encrypted)   // see track 2
Call        id, tenantId, startedAt, durationSec, transcript    // logs/metering
```
Everything except User/Tenant carries a `tenantId`; **every query is scoped by it.**

### Recommended stack
- **Auth:** Clerk — fastest, has Organizations (= our tenants), invites, and roles built in. (Alt: Auth.js/NextAuth + our own org tables if we want zero vendor lock-in.)
- **DB:** Postgres on Neon or Supabase + **Prisma** (or Drizzle) for the schema above.
- **Isolation:** resolve `tenantId` from the session on every request; scope all DB and ElevenLabs calls by it. (Postgres Row-Level Security as a second safety net.)

### App changes
- `middleware.js` gates the app routes; add public `/login`, `/sign-up`.
- A **workspace switcher** in the sidebar; the "SA" avatar becomes the real user.
- `lib/store.js` (file) → DB-backed `lib/agents.js` keyed by `tenantId`. **One ElevenLabs agent per tenant.**
- API routes read `tenantId` from the session, not from a global file.

### Phasing
1. **Single-workspace auth** — add login + DB, migrate `.agent.json` → one tenant row. (Small, unblocks everything.)
2. **Multi-tenant orgs** — invites, roles, workspace switching, RLS.
3. Usage metering per tenant (feeds billing later).

---

## 2. Effortless company-data connector

**Goal:** a client connects their existing system (orders, tickets, bookings, inventory, CRM) so the agent answers with **live data** — without us writing custom code per client.

### How it plugs into the agent
```
Caller ──▶ ElevenLabs agent ──(webhook tool)──▶ Arvo Connector Gateway ──▶ client's data source
                                                  /api/connectors/[id]/query
```
The agent already calls webhook tools. Instead of pointing each tool at bespoke code, it points at **one gateway** that routes to the right **adapter** for that workspace's connector.

### Pluggable adapters (one interface, many sources)
```js
// every adapter implements the same shape
async function query(intent, params, config) {
  // -> { ok: true, data } | { ok: false, error }
}
```
| Adapter | Connects to | Client provides |
|---|---|---|
| **REST / GraphQL** (default) | most SaaS / internal APIs | base URL, auth (API key / bearer / OAuth), endpoint templates |
| **Database (read-only)** | Postgres / MySQL | connection string (encrypted) + **allowlisted views/queries only** |
| **Spreadsheet** | Google Sheets / Airtable | OAuth or share link + sheet id |
| **Webhook / no-code** | client-hosted endpoint | a URL they expose |
| **Files** (already built) | static FAQs/policies | upload (the knowledge base) |

### "Effortless" setup UX (a new Connectors page)
1. Pick a source type.
2. Fill a short form (URL / credentials).
3. **Map intents → calls**, e.g. `look_up_order` → `GET /orders/{id}` returning `status, eta, items`.
4. **Test** with a sample value.
5. Save → Arvo **auto-generates the matching ElevenLabs tool(s)** and wires them to the agent (`prompt.toolIds`).

The intent map (`{ intent → { method, urlTemplate, inputSchema, outputFields } }`) is what lets us generate the tool's JSON schema automatically — no hand-coding per client.

### Safety (non-negotiable for client data)
- **Read-only by default**; DB adapter only runs allowlisted parameterized queries/views.
- **Field allowlist** per intent so we never leak PII the agent shouldn't speak.
- Per-connector **rate limits**, **timeouts**, and short-TTL **caching** of hot lookups.
- Secrets **encrypted at rest**; every query **audit-logged** (ties into the `Call` record).

### MVP path
- Build the **gateway + REST adapter** first; make the existing `lib/mocks.js` the reference connector behind it (so order/ticket lookups flow through the real path).
- Then auto-wire tools on save, and add the DB and Sheets adapters.

---

## Suggested sequence
**single-workspace auth → DB migration → connector gateway + REST adapter (wire tools) → multi-tenant orgs → metering/billing → deploy.**
