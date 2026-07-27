import assert from 'assert/strict';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const renderer = path.resolve(__dirname, '../skills/standby/render-watch-rows.mjs');

const rows = [
  {
    id: 11,
    from_agent: 'cursor',
    to_agent: 'codex',
    status: 'ACTION_REQUIRED',
    topic: 'pipe|tab\tline\nend',
  },
  {
    id: 12,
    from_agent: 'claude',
    to_agent: 'all',
    status: 'UNREAD',
    topic: 'FYI\nsecond line',
  },
];

const result = spawnSync('node', [renderer, 'codex'], {
  input: JSON.stringify(rows),
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /1 message\(s\) for you/);
assert.match(result.stdout, /pipe\|tab\\tline\\nend/);
assert.match(result.stdout, /broadcasts \(FYI — not work, no action needed\)/);
assert.match(result.stdout, /FYI\\nsecond line/);
assert.equal(result.stdout.split('\n').filter((line) => line.includes('#11')).length, 1);
assert.equal(result.stdout.split('\n').filter((line) => line.includes('#12')).length, 1);

const countResult = spawnSync('node', [renderer, 'codex', '--direct-count'], {
  input: JSON.stringify(rows),
  encoding: 'utf8',
});
assert.equal(countResult.status, 0, countResult.stderr);
assert.equal(countResult.stdout.trim(), '1');

const maxIdResult = spawnSync('node', [renderer, 'codex', '--max-id'], {
  input: JSON.stringify(rows),
  encoding: 'utf8',
});
assert.equal(maxIdResult.status, 0, maxIdResult.stderr);
assert.equal(maxIdResult.stdout.trim(), '12');

console.log('Standby watcher JSON rendering PASSED.');
