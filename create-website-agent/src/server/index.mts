import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { join, resolve } from 'node:path';
import { agentIO, type UploadedFile } from './agent-io.mts';
import { runWebsiteAgent, runRevision } from '../graph/website-graph.mts';
import { env } from '../env.mts';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const ROOT = resolve(import.meta.dir, '..', '..');
const MAX_REVISIONS = 5;

// Serve generated sites
app.use('/generated-websites', express.static(join(ROOT, 'generated-websites')));

// Serve the web UI
app.use(express.static(join(ROOT, 'public')));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(ROOT, 'public', 'index.html'));
});

// ─── Server-level revision state (persists across WebSocket reconnections) ─────

interface RevisionState {
  businessContextJson: string;
  researchNotesJson: string;
  baseSlug: string;
  count: number;
}

let revisionState: RevisionState | null = null;

// ─── WebSocket handler ────────────────────────────────────────────────────────

wss.on('connection', (ws: WebSocket) => {
  console.log('[ws] client connected');
  let isRunning = false;

  ws.on('message', async (data: Buffer) => {
    let msg: {
      type: string;
      id?: string;
      value?: string;
      mimeType?: string;
      base64?: string;
      filename?: string;
    };

    try {
      msg = JSON.parse(data.toString()) as typeof msg;
    } catch {
      return;
    }

    // ── Fresh build ──────────────────────────────────────────────────────────
    if (msg.type === 'start' && !isRunning) {
      isRunning = true;
      revisionState = null;
      agentIO.clearRevisionData();
      agentIO.register(ws);

      try {
        await runWebsiteAgent();
        // Capture business data for potential revisions
        const data = agentIO.getRevisionData();
        if (data['businessContextJson'] && data['researchNotesJson'] && data['baseSlug']) {
          revisionState = {
            businessContextJson: data['businessContextJson'],
            researchNotesJson: data['researchNotesJson'],
            baseSlug: data['baseSlug'],
            count: 0,
          };
        }
        // Always send revision_available so the button is shown
        agentIO.revisionAvailable(revisionState?.count ?? 0, MAX_REVISIONS);
      } catch (err: unknown) {
        agentIO.error(err instanceof Error ? err.message : String(err));
      } finally {
        isRunning = false;
        agentIO.unregister();
      }
    }

    // ── Revision request ─────────────────────────────────────────────────────
    if (msg.type === 'revise' && !isRunning) {
      if (!revisionState) return;
      if (revisionState.count >= MAX_REVISIONS) {
        agentIO.reviseLimit();
        return;
      }

      isRunning = true;
      revisionState.count++;
      const { businessContextJson, researchNotesJson, baseSlug } = revisionState;
      const revisionSlug = `${baseSlug}-rev-${revisionState.count}`;
      const currentCount = revisionState.count;

      agentIO.register(ws);
      agentIO.reviseStart(currentCount, MAX_REVISIONS);

      try {
        await runRevision(businessContextJson, researchNotesJson, revisionSlug);
        agentIO.revisionAvailable(currentCount, MAX_REVISIONS);
      } catch (err: unknown) {
        agentIO.error(err instanceof Error ? err.message : String(err));
      } finally {
        isRunning = false;
        agentIO.unregister();
      }
    }

    // ── Forward answer ───────────────────────────────────────────────────────
    if (msg.type === 'answer') {
      agentIO.receiveAnswer(msg.value ?? '');
    }

    // ── Forward file upload ──────────────────────────────────────────────────
    if (msg.type === 'upload' && msg.base64 && msg.mimeType) {
      const file: UploadedFile = {
        base64: msg.base64,
        mimeType: msg.mimeType,
        filename: msg.filename ?? 'logo',
      };
      agentIO.receiveUpload(file);
    }

    // ── Skip logo upload ─────────────────────────────────────────────────────
    if (msg.type === 'upload_skip') {
      agentIO.receiveUpload(null);
    }
  });

  ws.on('close', () => {
    console.log('[ws] client disconnected');
    agentIO.unregister();
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    httpServer.listen(env.PORT, () => {
      console.log(`SERVER_READY:${env.PORT}`);
      console.log(`Web UI → http://localhost:${env.PORT}`);
      resolve();
    });
  });
}
