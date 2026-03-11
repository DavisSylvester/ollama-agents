/**
 * Entry point.
 *
 * Usage:
 *   bun run-agent.mts        — start the web UI server (browser + WebSocket)
 *   bun run --electron .     — launch as Electron desktop app (electron spawns this)
 *
 * The Express server serves public/index.html.
 * The LangGraph ralph loop starts when the browser sends { type: "start" } via WebSocket.
 */
import { startServer } from './src/server/index.mts';

await startServer();
