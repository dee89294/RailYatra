/**
 * ============================================================================
 * File: scripts/dev.mjs
 * Purpose: Cross-platform monorepo development runner for RailYatra.
 * Responsibilities:
 *   - Spawns both the Express backend API (port 5000) and Vite React frontend
 *     (port 5173) in parallel with readable prefixed console output.
 *   - Uses `ignore` on child `stdin` so Vite's interactive shortcut listener
 *     never blocks or competes for stdin on Windows.
 *   - Avoids Node DEP0190 shell deprecation by invoking `cmd.exe /c npm ...`
 *     explicitly on Windows and cleanly terminates child trees on shutdown.
 * Used by: `npm run dev` in the root package.json.
 * ============================================================================
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const isWindows = process.platform === 'win32';

/**
 * Starts a child npm script inside a subdirectory and prefixes its output.
 * @param {string} label - Console prefix label (e.g., "SERVER" or "CLIENT")
 * @param {string} cwd - Directory containing the subproject's package.json
 * @param {string[]} args - Arguments passed to npm
 * @returns {import('node:child_process').ChildProcess}
 */
function startProcess(label, cwd, args) {
  const command = isWindows ? 'cmd.exe' : 'npm';
  const commandArgs = isWindows ? ['/c', 'npm', ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd: path.resolve(process.cwd(), cwd),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefixLine = (stream, chunk) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        stream.write(`[${label}] ${line}\n`);
      }
    }
  };

  child.stdout?.on('data', (chunk) => prefixLine(process.stdout, chunk));
  child.stderr?.on('data', (chunk) => prefixLine(process.stderr, chunk));

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });

  return child;
}

function killTree(child) {
  if (!child?.pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    child.kill('SIGTERM');
  }
}

console.log('Starting RailYatra Full-Stack Development Environment...');
console.log(' -> Backend API: http://localhost:5000');
console.log(' -> Frontend UI: http://localhost:5173\n');

const serverProc = startProcess('SERVER', 'server', ['run', 'dev']);
const clientProc = startProcess('CLIENT', 'client', ['run', 'dev']);

function shutdown() {
  console.log('\nShutting down RailYatra dev servers...');
  killTree(serverProc);
  killTree(clientProc);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
