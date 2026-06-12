# Arvo — white-label voice support agents

Your own dashboard for creating AI voice support agents. **ElevenLabs is the engine, hidden behind your backend** — your clients never see it or get redirected.

- **Frontend + backend:** Next.js (App Router, plain JS)
- **Engine:** ElevenLabs Conversational AI, called server-side via `@elevenlabs/elevenlabs-js`
- **In-browser voice:** `@elevenlabs/react` `useConversation` — headless, **no ElevenLabs branding**, connects with a WebRTC token your backend mints

## How it fits together
```
Your dashboard (this app)  ──▶  /api/* route handlers  ──▶  ElevenLabs API
  - configure agent              (hold the API key)            (hidden engine)
  - upload knowledge             - create/update agent
  - talk to agent (mic)          - upload KB docs
                                 - mint WebRTC token
                                 - tool webhooks (orders/tickets/…)
```

## Run it
1. `npm install`
2. Put your key in `.env.local`: `ELEVENLABS_API_KEY=...` (from elevenlabs.io → Profile → API Keys). Free tier is fine for testing.
3. `npm run dev` → open http://localhost:3000
4. **Step 1:** fill the form → *Create agent* (this creates it on ElevenLabs and saves the id to `.agent.json`).
5. **Step 2:** upload `sample-company-faq.md` (or paste text).
6. **Step 3:** click *Talk to agent*, allow the mic, and have a conversation — all in this page.

## What works where
- **Locally:** config, knowledge base, and the in-browser voice all work (ElevenLabs talks to your browser directly).
- **Tools (live order/ticket lookup)** in `app/api/tools/*` need a **public URL** so ElevenLabs can reach them — they light up once you deploy (or expose localhost with a tunnel). The endpoints work now (curl them); attaching them to the agent comes after deploy.

## Deploy (your "push a switch")
Push to GitHub and import into **Vercel** — it builds and runs Next.js automatically. Set `ELEVENLABS_API_KEY` in the Vercel project env. That public URL is also where the tool webhooks become reachable.

## Roadmap (next steps)
- **Phone numbers:** connect Twilio/Exotel to the agent via API (both channels).
- **Tool auto-wiring:** create + link the 4 webhook tools to the agent using the deployed URL.
- **Multi-tenant:** client login + a database (replacing `.agent.json`), one agent per client.

> Note: ElevenLabs' free tier is non-commercial — move to a paid plan before serving real clients.

## Customise
- Branding: app name in `components/dashboard-shell.jsx` (sidebar) + `app/layout.js` (page title) — "Arvo".
- Default prompt / voice / LLM: `app/components/AgentConfig.jsx`.
- Mock order/ticket data: `lib/mocks.js`.
