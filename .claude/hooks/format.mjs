// PostToolUse hook: formats a file Claude edited with the frontend's Prettier — the same files and
// config as `npm run format` (frontend/src, e2e). Does nothing for other files or without node_modules.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!file) process.exit(0);

const relative = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
const formatted =
  /^frontend\/src\/.+\.(ts|html|scss)$/.test(relative) ||
  /^e2e\/([^/]+\.ts|tests\/.+\.ts|telegram-mock\/.+\.mjs)$/.test(relative);
const prettier = path.join(root, 'frontend', 'node_modules', 'prettier', 'bin', 'prettier.cjs');
if (!formatted || !existsSync(prettier)) process.exit(0);

try {
  execFileSync(process.execPath, [prettier, '--write', '--log-level', 'silent', path.join(root, relative)], {
    cwd: path.join(root, 'frontend'),
    stdio: 'ignore',
  });
} catch {
  // A syntax error is left for the build and lint to report.
}
