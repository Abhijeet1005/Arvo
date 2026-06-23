# Arvo — AI voice support agents

Arvo is a dashboard for building, configuring, and talking to AI voice support agents. Set up an agent, give it your company's knowledge base, wire up tools like order and ticket lookup, and have a live voice conversation with it right in the browser.

Built with Next.js (App Router) and [ElevenLabs Conversational AI](https://elevenlabs.io) for the voice engine.

## Features

- **Agent configuration** — name, system prompt, voice, and LLM, all from a form.
- **Knowledge base** — upload documents or paste text the agent answers from.
- **In-browser voice** — talk to your agent with your mic, with a live transcript.
- **Tools** — server-side webhooks for live lookups (orders, tickets), taking messages, and call transfer.
- **Modern UI** — warm-minimal theme, light/dark mode, responsive dashboard, page-load progress.

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
- `scripts/` — agent setup helper

## Roadmap

- **Phone numbers** — connect Twilio/Exotel for inbound/outbound calls.
- **Authentication** — protect the dashboard with login.
- **Multi-tenant** — a database (replacing `.agent.json`) with one agent per account.
