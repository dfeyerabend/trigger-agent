# Trigger Agent

A small TypeScript showcase project that demonstrates a "triggerable" agent: a single unified handler that accepts requests from multiple entry points (HTTP and WebSocket), validates incoming requests with zod, forwards tasks to an LLM via the OpenAI SDK, and tracks basic runtime statistics.

> This README is written as a standard GitHub repository README. (Note: ignore `test-report.md` — it is not part of the public docs.)


## Features

- Unified handler for multiple input sources (HTTP + WebSocket).
- Schema validation using `zod`.
- Integration with OpenAI via the `openai` SDK.
- Lightweight stats tracking: total requests, successes, failures, average duration.
- Health endpoint that exposes runtime stats.
- Requests are logged in JSON format 


## Tech stack

- TypeScript
- Bun runtime (project uses Bun tooling in the repo)
- express (HTTP)
- ws (WebSocket)
- zod (validation)
- openai (LLM client)

The code lives in `src/trigger_agent.ts`.


## Quick contract

- Inputs: normalized trigger objects that include `source`, `payload`, and `metadata`.
- Outputs: JSON objects with `success`, `result` (on success), `error` (on failure), `traceId`, `source`, and `durationMs`.
- Error mode: invalid requests produce a 200 JSON response where `success: false` and `error: "Invalid trigger format"`.


## Ports & defaults (as implemented)

- HTTP server: http://localhost:3333
  - POST /agent — submit tasks
  - GET /health — health + stats
- WebSocket server: ws://localhost:8555

These values are taken from `src/trigger_agent.ts` and can be changed in the source code.


## Environment variables

- `OPENAI_API_KEY` — (required) OpenAI API key.
- `OPENAI_MODEL` — (optional) model name, default: `gpt-4o-mini`.

Do NOT commit your API key or other secrets. Use a `.env` file (keep it in `.gitignore`) or your system's environment configuration.


## Install & run (Windows / cmd.exe)

Install dependencies (from the repository root):

```bash
bun install
```

Set your OpenAI key (example for Windows cmd.exe):

```cmd
set OPENAI_API_KEY=YOUR_KEY_HERE
set OPENAI_MODEL=gpt-4o-mini
```

Start the server:

```cmd
bun run src/trigger_agent.ts
```

After startup you should see the HTTP and WebSocket endpoints printed in the console.


## Usage examples

Health check (HTTP):

```cmd
curl http://localhost:3333/health
```

Trigger via HTTP (Windows cmd.exe, use ^ for line continuation):

```cmd
curl -X POST http://localhost:3333/agent ^
  -H "Content-Type: application/json" ^
  -d "{\"task\": \"Say hello\"}"
```

PowerShell example (single-line):

```powershell
Invoke-RestMethod -Uri "http://localhost:3333/agent" -Method Post -ContentType "application/json" -Body '{"task":"Say hello"}'
```

WebSocket example (using wscat or any WebSocket client):

```bash
# install wscat if you don't have it
npm install -g wscat

# connect (replace port if changed)
npx wscat -c ws://localhost:8555

# then send a JSON message
> {"task":"Say hello!"}
```

Both HTTP and WebSocket messages are routed into the same unified handler and share the same validation and result format.


## Request format

The unified handler expects a normalized trigger shape. When calling the handler directly (or via HTTP/WebSocket), the normalized shape is:

- `source`: `"api"` or `"websocket"`
- `payload`: object with `task: string` (required, min length 1)
- `metadata`: object containing `traceId` (optional — generated if missing)

The public HTTP endpoint accepts the `payload` as the POST body and will add `source: "api"` and a `traceId` (from `x-trace-id` header if provided, otherwise generated).


## Health and stats

GET /health returns a JSON object with:

- `status` (string)
- `timestamp`
- `uptime`
- `stats`: { totalRequests, successfulRequests, failedRequests, averageDurationMs }


## Troubleshooting

- Port already in use: stop the conflicting process or change the ports in `src/trigger_agent.ts`.
- OpenAI errors: check the `OPENAI_API_KEY`, and ensure the model name (via `OPENAI_MODEL`) is correct.
- WebSocket connection refused: ensure the server is running and that you used the correct port.

Useful Windows commands to find processes using a port:

```cmd
netstat -ano | findstr ":3333"
taskkill /F /PID <pid>
```


## Notes & best practices

- Do not commit secrets (add `.env` to `.gitignore`).
- The repository includes `2026-01-27_Dienstag_HOMEWORK.md` which documents the dependencies and an extended walkthrough — it was used as context for this README.
- Ignore `test-report.md` (not part of the published README content).


## Contributing

Feel free to open issues or pull requests. Suggested small improvements:

- Add a `package.json` script to start the server (e.g. `start`),
- Add unit tests for the handler and schema,
- Implement graceful shutdown and connection counting.


## License

Add a `LICENSE` file (for example MIT) if you plan to open-source this repository.


---

If you'd like, I can also add a short `scripts` entry to `package.json`, add a `.gitignore` entry for `.env`, or create a small example curl script for convenience.
