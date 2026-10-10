# Arvo — AI voice support agents

Arvo is a dashboard for building, configuring, and talking to AI voice support agents. Set up an agent, give it your company's knowledge base, wire up tools like order and ticket lookup, and have a live voice conversation with it right in the browser.

Built with Next.js (App Router) and [ElevenLabs Conversational AI](https://elevenlabs.io) for the voice engine.

## Features

- **Agent configuration** — name, system prompt, voice, and LLM, all from a form.
- **Knowledge base** — upload documents or paste text the agent answers from.
- **In-browser voice** — talk to your agent with your mic, with a live transcript.
- **Tools** — server-side webhooks for live lookups (orders, tickets), taking messages, and call transfer.
- **Modern UI** — warm-minimal theme, light/dark mode, responsive dashboard, page-load progress.
- **Demo factory** — give any company its own branded voice agent and a link to try it. See below.

## Demo factory

For showing a prospect what an AI voice agent would do for *their* business. Open `/loan?view=demos` (or **Demo factory** in the sidebar):

1. **New demo** → paste the company's website → **Read website**. Arvo reads the page (and a few key pages such as About, Services and Contact), fills in the name, services, hours, address, phone, logo and brand colour, and drafts what the agent knows. Review it, pick a language and persona, and create.
2. The demo gets **its own voice agent** (created and kept in sync on the server) and a **link** like `/d/<token>`. The page carries the company's name, logo and colour, shows a live checklist of the conversation, and when the call ends shows the lead the agent captured: who called, why, what they want, a summary.
3. Send the link. The **Activity** feed shows who tried it, with the same details, and (optionally) a Slack or Discord message arrives for every call.

Two templates: an **inbound assistant** (any local business, home services, real estate; English or Hinglish) and the **loan qualifier** (outbound, India, Hinglish) that the Lending console runs.

Safeguards on every demo: the agent says it is an AI, answers only from the text you gave it and says the team will confirm anything else, refuses card numbers/OTPs/passwords, and flags emergencies. Each agent has its own cap on concurrent and daily calls and on call length; each link has an allowance of calls, an expiry, and can be turned off. The browser never supplies a prompt or an agent id, so a link can only ever start the agent it was made for. Reading a website only follows public addresses (private ranges, redirects into them and non-web ports are refused), obeys `robots.txt`, and is size- and time-limited.

Optional settings (environment):

| Variable | Purpose |
| --- | --- |
| `ARVO_NOTIFY_WEBHOOK` | A Slack or Discord incoming-webhook URL. A message is sent when a demo call starts and when its summary is ready. |
| `ARVO_CALL_PATH` | Where demo links live. Default `/d`. Set `/loan/call` if a proxy only exposes that path. |

A reverse proxy in front of the operator console must let `/d/*`, `/api/loan/links/*/{public,session,result}` and `POST /api/loan/calls` through without a login, and keep everything else (including `/api/demos/*`) behind one. `deploy/gcp/Caddyfile.template` does exactly this.

## How it works

```
Dashboard (this app)  ──▶  /api/* route handlers  ──▶  ElevenLabs API
  - configure agent          (hold the API key            - create/update agent
  - upload knowledge          server-side)                - upload KB docs
  - talk via mic                                           - mint WebRTC token
                                                           - tool webhooks
```

The API key lives only on the server. The browser connects to the voice engine using a short-lived WebRTC token minted by the backend, so the key is never exposed to the client.

## Getting started

1. `npm install`
2. Create `.env.local` with your key (from elevenlabs.io → Profile → API Keys):
   ```
   ELEVENLABS_API_KEY=your_key_here
   ```
3. `npm run dev` and open http://localhost:3000
4. **Configure** your agent → *Create agent* (saves the id to `.agent.json`).
5. **Add knowledge** — upload `sample-company-faq.md` or paste your own.
6. **Talk** — click *Talk to agent*, allow the mic, and start the conversation.

## Tools (live lookups)

The webhook tools in `app/api/tools/*` (order/ticket lookup, take message, request transfer) need a public URL so the voice engine can reach them. They attach to the agent automatically once deployed to a public host. Mock data lives in `lib/mocks.js`.

## Deploy

The app is a standard Next.js project and runs on any Node host (Vercel, or a VM behind a reverse proxy). Set `ELEVENLABS_API_KEY` in the host's environment. The public URL is also where the tool webhooks become reachable.

## Tech stack

- **Framework:** Next.js 15 (App Router), React 19
- **Styling:** Tailwind CSS, shadcn-style UI primitives, Inter
- **Voice:** ElevenLabs Conversational AI (`@elevenlabs/elevenlabs-js` server-side, `@elevenlabs/react` in the browser)

## Project layout

- `app/` — pages, API route handlers, and feature components
- `components/` — shared UI (dashboard shell, primitives, theme toggle)
- `lib/` — server helpers (API client, agent/tool config, mock data)
- `lib/demos/` — the demo factory: templates and prompts, demo model, per-demo agent sync, website reader, alerts
- `lib/loan/` — the loan advisor and the public link/call logic the demos build on
- `deploy/gcp/` — deploy scripts for a single VM (build on the server, Caddy for HTTPS and login, automatic rollback)
- `scripts/` — agent setup helper

## Roadmap

- **Phone numbers** — connect Twilio/Exotel for inbound/outbound calls.
- **Authentication** — protect the dashboard with login.
- **Multi-tenant** — a database (replacing `.agent.json`) with one agent per account.
