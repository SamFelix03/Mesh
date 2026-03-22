# Mesh backend (standalone deploy)

This folder is **self-contained**: the HTTP API, workflow index, **Foundry contracts** (`contracts/`), and **demo DSL templates** (`templates/`). No sibling monorepo paths are required at runtime.

## Layout

| Path | Purpose |
|------|---------|
| `src/` | Fastify app, DSL, deploy services |
| `contracts/` | Solidity + `forge build` output (`out/`) consumed by `src/artifacts.ts` |
| `templates/` | `demo-01` / `demo-02` workflow JSON (`mesh init` copies these to `workflows/`) |
| `data/` | `workflows-index.json` (gitignored; created when you deploy or bootstrap) |

Optional override: set **`CONTRACTS_ROOT`** if artifacts live outside `contracts/` (see `env.example`).

## Run locally

```bash
cp env.example .env
# set PRIVATE_KEY, WORKFLOW_REGISTRY_ADDRESS, RPC URLs, …
cd contracts && npm install && forge build && cd ..
npm install && npm run dev
```

## Production-style run

```bash
npm ci
cd contracts && npm ci && forge build && cd ..
npm run build
node dist/index.js
```

Ship the whole `backend/` directory (including `contracts/out` from `forge build`, or run `forge build` in your image). The frontend is optional and only talks to this API over HTTP/WebSocket.
