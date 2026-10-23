# Lessons

## Stop background servers completely

- **What happened (2026-10-21):** I started `npm run dev` as a background task and stopped the task when I was done. The `node scripts/dev-server.js` child process kept running and held port 5173, so the user could not start the dev server.
- **Rule:** after you stop a background server, check the port (`Get-NetTCPConnection -LocalPort 5173 -State Listen`). If a process still listens, stop it. Then tell the user the port is free.

## Reuse a running dev server

- **What happened (2026-10-23):** the user asked me not to start a second server when one already runs.
- **Rule:** before you start a server, check if port 5173 listens. If it does, use http://localhost:5173/ and do not stop that server after the test.
- **Do not use Live Server (port 5500) for this app.** The CSP blocks its injected reload script and its WebSocket, so the console shows CSP errors that look like app bugs.
