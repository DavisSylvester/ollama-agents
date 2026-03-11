/* AI Website Builder — LangGraph ralph loop frontend */
'use strict';

let ws = null;
let currentUploadId = null;
let previewUrl = null;
let streamingEl = null;

// ─── WebSocket ────────────────────────────────────────────────────────────────

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen  = () => setStatus('Connected', 'green');
  ws.onclose = () => { setStatus('Disconnected', 'red'); ws = null; };
  ws.onerror = () => setStatus('Error', 'red');
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}

function handle(msg) {
  switch (msg.type) {
    case 'stage':          handleStage(msg);         break;
    case 'question':       handleQuestion(msg);       break;
    case 'upload_request': handleUploadRequest(msg);  break;
    case 'log':            handleLog(msg);             break;
    case 'thinking':       handleThinking();           break;
    case 'thinking_end':   handleThinkingEnd();        break;
    case 'stream_start':   handleStreamStart(msg);    break;
    case 'stream_chunk':   handleStreamChunk(msg);    break;
    case 'stream_end':     handleStreamEnd();          break;
    case 'done':           handleDone(msg);            break;
    case 'complete':       handleComplete(msg);        break;
    case 'error':          handleError(msg);           break;
    case 'revision_available': handleRevisionAvailable(msg); break;
    case 'revise_start':       handleReviseStart(msg);       break;
    case 'revise_limit':       handleReviseLimit();           break;
  }
}

// ─── Message handlers ─────────────────────────────────────────────────────────

function handleStage({ step, label }) {
  const num = parseInt(step, 10);
  for (let i = 1; i < num; i++) markStage(i, 'done');
  markStage(num, 'active');
  addSystemMessage(`▶ ${label}`);
  setStatus(`Stage ${step}/7`, 'blue');
}

function handleQuestion({ question, choices }) {
  addAgentMessage(question);
  showInputPanel(choices);
  focusInput();
}

function handleUploadRequest({ id, label, accept }) {
  currentUploadId = id;
  addAgentMessage(label);
  showUploadPanel(accept);
}

function handleLog({ message }) {
  addLogMessage(message);
}

function handleStreamStart({ label }) {
  streamingEl = addAgentMessage(label ? `${label}...` : '');
  streamingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  streamingEl._streaming = true;
  streamingEl._text = '';
}

function handleStreamChunk({ chunk }) {
  if (!streamingEl) return;
  if (streamingEl._streaming) {
    streamingEl._streaming = false;
    streamingEl.innerHTML = '';
  }
  streamingEl._text += chunk;
  streamingEl.textContent = streamingEl._text;
  scrollToBottom();
}

function handleStreamEnd() {
  streamingEl = null;
}

function handleDone({ label }) {
  addLogMessage(`✓ ${label} complete`);
}

function handleComplete({ slug, previewPath }) {
  previewUrl = previewPath;
  for (let i = 1; i <= 7; i++) markStage(i, 'done');
  setStatus('Complete!', 'green');
  showCompletePanel();
  showPreviewThumb(previewPath);
  // Show revise button immediately — server will update count via revision_available
  const btn = document.getElementById('revise-btn');
  const rem = document.getElementById('revise-remaining');
  if (btn && rem) { rem.textContent = '(5 left)'; btn.classList.remove('hidden'); }
}

function handleError({ message }) {
  addErrorMessage(message);
  setStatus('Error', 'red');
  showStartPanel();
}

function handleRevisionAvailable({ count, max }) {
  const btn = document.getElementById('revise-btn');
  const rem = document.getElementById('revise-remaining');
  const remaining = max - count;
  if (!btn || remaining <= 0) {
    btn?.classList.add('hidden');
    if (remaining <= 0) addLogMessage('Maximum revisions reached.');
    return;
  }
  if (rem) rem.textContent = `(${remaining} left)`;
  btn.classList.remove('hidden');
}

function handleReviseStart({ count, max }) {
  document.getElementById('revise-btn')?.classList.add('hidden');
  addSystemMessage(`▶ Revision ${count} of ${max}`);
  setStatus(`Revising ${count}/${max}`, 'blue');
  hideAll();
}

function handleReviseLimit() {
  addErrorMessage('Maximum of 5 revisions reached. Click "Build Another" to start fresh.');
}

function requestRevision() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'revise' }));
}

// ─── UI actions ───────────────────────────────────────────────────────────────

function startBuild() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
    setTimeout(() => ws?.send(JSON.stringify({ type: 'start' })), 300);
  } else {
    ws.send(JSON.stringify({ type: 'start' }));
  }
  hideAll();
  setStatus('Starting...', 'blue');
}

function sendAnswer() {
  const input = document.getElementById('answer-input');
  const value = input.value.trim();
  ws.send(JSON.stringify({ type: 'answer', value }));
  addUserMessage(value || '(skipped)');
  input.value = '';
  hideInputPanel();
}

function handleKey(e) {
  if (e.key === 'Enter') sendAnswer();
}

function selectChoice(value) {
  document.getElementById('answer-input').value = value;
  sendAnswer();
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

function showUploadPanel(accept) {
  hideInputPanel();
  const panel = document.getElementById('upload-panel');
  document.getElementById('logo-file-input').accept = accept || 'image/*';
  panel.classList.remove('hidden');
  panel.classList.add('flex');
}

function hideUploadPanel() {
  const panel = document.getElementById('upload-panel');
  panel.classList.add('hidden');
  panel.classList.remove('flex');
  document.getElementById('logo-file-input').value = '';
  document.getElementById('logo-preview').classList.add('hidden');
  document.getElementById('logo-preview').classList.remove('flex');
}

function onLogoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('logo-preview-img').src = ev.target.result;
    document.getElementById('logo-preview').classList.remove('hidden');
    document.getElementById('logo-preview').classList.add('flex');
  };
  reader.readAsDataURL(file);
}

function uploadLogo() {
  const file = document.getElementById('logo-file-input').files[0];
  if (!file || !currentUploadId) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const [header, base64] = ev.target.result.split(',');
    const mimeType = header.match(/:(.*?);/)[1];
    ws.send(JSON.stringify({ type: 'upload', id: currentUploadId, mimeType, base64, filename: file.name }));
    addUserMessage(`Uploaded logo: ${file.name}`);
    currentUploadId = null;
    hideUploadPanel();
  };
  reader.readAsDataURL(file);
}

function skipUpload() {
  ws.send(JSON.stringify({ type: 'upload_skip', id: currentUploadId }));
  addUserMessage('(no logo — skipped)');
  currentUploadId = null;
  hideUploadPanel();
}

// ─── Panel management ─────────────────────────────────────────────────────────

function hideAll() {
  ['start-panel','input-panel','upload-panel','complete-panel','welcome'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

function showInputPanel(choices) {
  hideUploadPanel();
  const panel = document.getElementById('input-panel');
  const choicesRow = document.getElementById('choices-row');
  panel.classList.remove('hidden');
  panel.classList.add('flex');
  choicesRow.innerHTML = '';
  if (choices && choices.length) {
    choicesRow.classList.remove('hidden');
    choicesRow.classList.add('flex');
    choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.textContent = c;
      btn.className = 'px-3 py-1 text-sm rounded-lg border border-surface-border text-slate-300 hover:border-brand hover:text-brand transition-colors';
      btn.onclick = () => selectChoice(c);
      choicesRow.appendChild(btn);
    });
  } else {
    choicesRow.classList.add('hidden');
  }
}

function hideInputPanel() {
  document.getElementById('input-panel').classList.add('hidden');
  document.getElementById('input-panel').classList.remove('flex');
}

function showStartPanel() {
  document.getElementById('start-panel').classList.remove('hidden');
}

function showCompletePanel() {
  hideInputPanel();
  hideUploadPanel();
  const panel = document.getElementById('complete-panel');
  panel.classList.remove('hidden');
  panel.classList.add('flex');
}

function showPreviewThumb(path) {
  document.getElementById('preview-iframe').src = path;
  document.getElementById('preview-thumb').classList.remove('hidden');
}

function focusInput() {
  setTimeout(() => document.getElementById('answer-input')?.focus(), 50);
}

function openPreview() {
  if (previewUrl) window.open(previewUrl, '_blank');
}

function resetApp() {
  location.reload();
}

// ─── Chat message builders ────────────────────────────────────────────────────

function addAgentMessage(text) {
  const box = document.getElementById('chat-box');
  const row = document.createElement('div');
  row.className = 'flex gap-3 animate-fade-in';
  row.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-1">AI</div>
    <div class="bg-surface-card border border-surface-border rounded-2xl rounded-tl-none px-4 py-3 max-w-xl">
      <p class="text-slate-200 prose">${escHtml(text)}</p>
    </div>`;
  box.appendChild(row);
  scrollToBottom();
  return row.querySelector('p');
}

function addUserMessage(text) {
  const box = document.getElementById('chat-box');
  const row = document.createElement('div');
  row.className = 'flex gap-3 justify-end animate-fade-in';
  row.innerHTML = `
    <div class="bg-brand rounded-2xl rounded-tr-none px-4 py-3 max-w-xl">
      <p class="text-white">${escHtml(text)}</p>
    </div>
    <div class="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-slate-300 text-xs font-bold mt-1">YOU</div>`;
  box.appendChild(row);
  scrollToBottom();
}

function addLogMessage(text) {
  const box = document.getElementById('chat-box');
  const el = document.createElement('div');
  el.className = 'text-center text-xs text-slate-500 py-1 animate-fade-in';
  el.textContent = text;
  box.appendChild(el);
  scrollToBottom();
}

function addErrorMessage(text) {
  const box = document.getElementById('chat-box');
  const el = document.createElement('div');
  el.className = 'mx-auto max-w-lg bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm animate-fade-in';
  el.textContent = `Error: ${text}`;
  box.appendChild(el);
  scrollToBottom();
}

function addSystemMessage(text) {
  const box = document.getElementById('chat-box');
  const el = document.createElement('div');
  el.className = 'flex items-center gap-2 py-2 animate-fade-in';
  el.innerHTML = `<div class="flex-1 h-px bg-surface-border"></div><span class="text-xs text-slate-500 px-2 whitespace-nowrap">${escHtml(text)}</span><div class="flex-1 h-px bg-surface-border"></div>`;
  box.appendChild(el);
  scrollToBottom();
}

// ─── Pipeline sidebar ─────────────────────────────────────────────────────────

function markStage(num, state) {
  const el = document.querySelector(`.stage-item[data-stage="${num}"]`);
  if (!el) return;
  const icon  = el.querySelector('.stage-icon');
  const label = el.querySelector('span:last-child');
  el.classList.remove('bg-brand/10', 'bg-green-900/20');
  icon.classList.remove('border-brand', 'text-brand', 'border-green-500', 'text-green-400', 'bg-green-500');
  label.classList.remove('text-brand', 'text-white', 'text-green-400');
  if (state === 'active') {
    el.classList.add('bg-brand/10');
    icon.classList.add('border-brand', 'text-brand');
    label.classList.add('text-white');
    icon.innerHTML = num;
  } else if (state === 'done') {
    el.classList.add('bg-green-900/20');
    icon.classList.add('border-green-500', 'bg-green-500', 'text-white');
    label.classList.add('text-green-400');
    icon.innerHTML = '&#10003;';
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function setStatus(text, color) {
  const badge = document.getElementById('status-badge');
  badge.textContent = text;
  badge.className = 'text-xs px-2 py-1 rounded-full bg-surface border border-surface-border';
  const colors = { green: 'text-green-400 border-green-800', red: 'text-red-400 border-red-800', blue: 'text-brand border-brand/30' };
  badge.className += ' ' + (colors[color] || 'text-slate-400');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scrollToBottom() {
  const box = document.getElementById('chat-box');
  box.scrollTop = box.scrollHeight;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Init
connect();
