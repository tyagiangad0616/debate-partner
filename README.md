# AI Debate Partner

A small web app for practising timed debates against an AI opponent.

Choose a motion and a side, take a short timed round, then read a simple report on the argument.

## Features

- Accounts, login, and personal debate history
- Topic setup: proposition or opposition, text or voice, 1–3 minutes per speech
- Timed floor with an AI opponent
- A short analysis report after the round
- Dashboard with recent sessions

## Stack

- Client: React, Vite, Tailwind
- Server: Express, Prisma, SQLite
- Optional OpenAI key for live replies and analysis (otherwise a local fallback)

## Setup

```bash
cp .env.example server/.env
npm run setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Put an OpenAI key in `server/.env` if you want a live opponent. Leave it empty to run locally without one. The key stays on the server.

```
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

## Tests

```bash
npm test
```
