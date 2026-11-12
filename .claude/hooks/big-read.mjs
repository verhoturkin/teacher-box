// PreToolUse hook on Read: refuses a whole-file Read of a text file over 40 KB so the agent reads
// only the part it needs (AGENTS.md §11). Images, PDF and notebooks pass. Fails open on any error.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const LIMIT = 40 * 1024;
const SKIPPED = /\.(png|jpe?g|gif|webp|bmp|ico|svg|pdf|ipynb)$/i;

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { file_path: file, offset, limit } = input.tool_input ?? {};
  if (!file || offset != null || limit != null || SKIPPED.test(file)) process.exit(0);
  const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const size = statSync(path.resolve(root, file)).size;
  if (size <= LIMIT) process.exit(0);
  const kb = Math.round(size / 1024);
  const reason =
    `${path.basename(file)} is ${kb} KB. Get the outline first (grep -n '^##' for Markdown, ` +
    `grep -n for symbols in code), then Read only the section you need with offset/limit.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
} catch {
  // Fail open: a missing file or bad input is left for the Read tool to report.
}
