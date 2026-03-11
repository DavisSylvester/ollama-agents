import { WebSocket } from 'ws';

export interface UploadedFile {
  base64: string;
  mimeType: string;
  filename: string;
}

/**
 * AgentIO bridges LangChain tools and the WebSocket client.
 *
 * Tools call agentIO.ask() / agentIO.log() / etc.
 * The server registers the active WebSocket via agentIO.register().
 * Incoming messages from the browser are forwarded via receiveAnswer() / receiveUpload().
 *
 * Singleton so all tools share one instance without prop-drilling.
 */
class AgentIO {
  private ws: WebSocket | null = null;
  private resolveAnswer: ((v: string) => void) | null = null;
  private resolveUpload: ((v: UploadedFile | null) => void) | null = null;
  private revisionData: Record<string, string> = {};

  register(ws: WebSocket): void {
    this.ws = ws;
  }

  unregister(): void {
    this.ws = null;
    this.resolveAnswer = null;
    this.resolveUpload = null;
  }

  saveForRevision(key: string, value: string): void {
    this.revisionData[key] = value;
  }

  getRevisionData(): Record<string, string> {
    return { ...this.revisionData };
  }

  clearRevisionData(): void {
    this.revisionData = {};
  }

  // ─── Bidirectional Q&A ──────────────────────────────────────────────────────

  ask(question: string, opts?: { choices?: string[]; placeholder?: string }): Promise<string> {
    return new Promise((resolve) => {
      this.resolveAnswer = resolve;
      this.send({
        type: 'question',
        id: crypto.randomUUID(),
        question,
        choices: opts?.choices,
        placeholder: opts?.placeholder,
      });
    });
  }

  askUpload(label: string, accept = 'image/*'): Promise<UploadedFile | null> {
    return new Promise((resolve) => {
      this.resolveUpload = resolve;
      this.send({ type: 'upload_request', id: crypto.randomUUID(), label, accept });
    });
  }

  receiveAnswer(value: string): void {
    this.resolveAnswer?.(value);
    this.resolveAnswer = null;
  }

  receiveUpload(file: UploadedFile | null): void {
    this.resolveUpload?.(file);
    this.resolveUpload = null;
  }

  // ─── One-way events (agent → client) ────────────────────────────────────────

  log(message: string): void {
    console.log(`[agent] ${message}`);
    this.send({ type: 'log', message });
  }

  stage(step: string, label: string): void {
    console.log(`\n[stage ${step}] ${label}`);
    this.send({ type: 'stage', step, label });
  }

  streamStart(label?: string): void {
    this.send({ type: 'stream_start', label });
  }

  stream(chunk: string): void {
    process.stdout.write(chunk);
    this.send({ type: 'stream_chunk', chunk });
  }

  streamEnd(): void {
    process.stdout.write('\n');
    this.send({ type: 'stream_end' });
  }

  thinking(): void {
    this.send({ type: 'thinking' });
  }

  thinkingEnd(): void {
    this.send({ type: 'thinking_end' });
  }

  done(label: string): void {
    console.log(`[✓] ${label}`);
    this.send({ type: 'done', label });
  }

  complete(slug: string): void {
    console.log(`\n[complete] generated-websites/${slug}/index.html`);
    this.send({ type: 'complete', slug, previewPath: `/generated-websites/${slug}/index.html` });
  }

  error(message: string): void {
    console.error(`[error] ${message}`);
    this.send({ type: 'error', message });
  }

  revisionAvailable(count: number, max: number): void {
    this.send({ type: 'revision_available', count, max });
  }

  reviseStart(count: number, max: number): void {
    this.send({ type: 'revise_start', count, max });
  }

  reviseLimit(): void {
    this.send({ type: 'revise_limit' });
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export const agentIO = new AgentIO();

// ─── Convenience wrappers used by tools ──────────────────────────────────────

export function ask(question: string, choices?: string[]): Promise<string> {
  return agentIO.ask(question, { choices });
}

export async function askRequired(question: string, defaultValue?: string): Promise<string> {
  for (;;) {
    const hint = defaultValue ? ` (default: ${defaultValue})` : '';
    const answer = await agentIO.ask(`${question}${hint}`);
    if (answer) return answer;
    if (defaultValue) return defaultValue;
  }
}

export async function askList(question: string): Promise<string[]> {
  const answer = await agentIO.ask(`${question} (comma-separated, or leave blank)`);
  if (!answer) return [];
  return answer.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function askOptional(question: string): Promise<string | undefined> {
  const answer = await agentIO.ask(`${question} (optional — leave blank to skip)`);
  return answer || undefined;
}
