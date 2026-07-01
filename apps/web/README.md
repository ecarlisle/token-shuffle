# Local dashboard

The v0.2 dashboard is a local React application served by the proxy. It provides
privacy-safe overview and detail views, structural replay, live updates,
diagnostics, and evidence deletion from the SQLite event ledger.

Development:

```sh
pnpm --filter @token-shuffle/web dev
```

The Vite server proxies `/api` to `http://127.0.0.1:3210`. Open the dashboard
through `token-shuffle open` so the browser can exchange a short-lived
administrative bootstrap code.
