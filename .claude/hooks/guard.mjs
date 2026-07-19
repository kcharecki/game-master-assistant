#!/usr/bin/env node
// PreToolUse(Bash) guard — project-scoped, committed.
// 1. Blocks destructive shell commands (override with a `#allow` comment in the command).
// 2. Enforces the green gate (lint · test · build) before any `git commit`.
// Exit 0 = allow. Exit 2 = block; stderr is fed back to Claude as the reason.
import { spawnSync } from 'node:child_process';

const raw = await new Promise((res) => {
  let d = '';
  process.stdin.on('data', (c) => (d += c));
  process.stdin.on('end', () => res(d));
});

let cmd = '';
try {
  cmd = JSON.parse(raw || '{}')?.tool_input?.command ?? '';
} catch {
  process.exit(0); // can't parse → don't block
}

const block = (msg) => {
  process.stderr.write(msg + '\n');
  process.exit(2);
};

// escape hatch: append `#allow` to a command to bypass the destructive guard
const overridden = /#allow\b/.test(cmd);

const DANGER = [
  [/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, 'rm -rf'],
  [/\bgit\s+push\s+.*(--force\b|-f\b)/i, 'git push --force'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard'],
  [/\bgit\s+clean\s+-[a-z]*f/i, 'git clean -f'],
];
if (!overridden) {
  for (const [re, name] of DANGER) {
    if (re.test(cmd)) {
      block(`Blocked destructive command (${name}). If intentional, append \`#allow\` to the command.`);
    }
  }
}

// green gate before commit. Match `git commit` only as a command head (start of line,
// or after &&/||/;/|/newline) so it doesn't fire on echo/grep strings that merely mention it.
const isCommit = /(?:^|[\n;&|(])\s*git\s+commit\b/.test(cmd) && !/\bNO_GATE\b/.test(cmd);
if (isCommit) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const gate = [
    ['lint', ['run', 'lint']],
    ['test', ['run', 'test']],
    ['build', ['run', 'build']],
  ];
  for (const [label, args] of gate) {
    const r = spawnSync(npm, args, { cwd: projectDir, encoding: 'utf8', shell: false });
    if (r.status !== 0) {
      const tail = ((r.stdout || '') + (r.stderr || '')).split('\n').slice(-40).join('\n');
      block(
        `Green gate failed at \`npm run ${label}\` — commit blocked. Fix, then commit again.\n` +
          `(Emergency bypass: add NO_GATE to the command.)\n\n${tail}`
      );
    }
  }
}

process.exit(0);
