'use strict';
/**
 * Electron main process.
 * Spawns the Bun web server (run-agent.mts) then opens a BrowserWindow.
 */
const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = parseInt(process.env.PORT ?? '3000', 10);
let win = null;
let serverProcess = null;

function startServer() {
  serverProcess = spawn('bun', ['run-agent.mts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON_RUN: '1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (d) => process.stdout.write(d));
  serverProcess.stderr.on('data', (d) => process.stderr.write(d));
  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[server] exited with code ${code}`);
  });
}

function waitForServer(retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`http://localhost:${PORT}`, (res) => {
        res.destroy();
        resolve();
      }).on('error', () => {
        attempts++;
        if (attempts >= retries) {
          reject(new Error(`Server did not start after ${retries} attempts`));
        } else {
          setTimeout(check, delay);
        }
      });
    };
    check();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Website Builder',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#0f172a',
  });

  win.loadURL(`http://localhost:${PORT}`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error(err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  serverProcess?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (win === null) createWindow();
});

app.on('before-quit', () => {
  serverProcess?.kill();
});
