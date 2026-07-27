import fs from 'fs';

const agent = process.argv[2];
const mode = process.argv[3] || '--render';
if (!agent) {
  throw new Error('agent_id argument is required');
}

const rows = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!Array.isArray(rows)) {
  throw new Error('expected a JSON array from sqlite3 -json');
}

const escapeForLine = (value) => JSON.stringify(String(value)).slice(1, -1);
const direct = rows.filter((row) => row.to_agent === agent);
const broadcasts = rows.filter((row) => row.to_agent !== agent);

if (mode === '--direct-count') {
  console.log(direct.length);
  process.exit(0);
}

if (mode === '--max-id') {
  console.log(Math.max(...rows.map((row) => Number(row.id))));
  process.exit(0);
}

if (mode !== '--render') {
  throw new Error(`unknown mode: ${mode}`);
}

if (direct.length > 0) {
  console.log(`  ${direct.length} message(s) for you:`);
  for (const row of direct) {
    console.log(
      `    #${String(row.id).padEnd(4)} ${String(row.from_agent).padEnd(14)} ${String(
        row.status
      ).padEnd(16)} ${escapeForLine(row.topic)}`
    );
  }
  console.log('    → tell your agent to run its standby cycle.');
}

if (broadcasts.length > 0) {
  console.log('  broadcasts (FYI — not work, no action needed):');
  for (const row of broadcasts) {
    console.log(
      `    #${String(row.id).padEnd(4)} ${String(row.from_agent).padEnd(14)} ${String(
        row.status
      ).padEnd(16)} ${escapeForLine(row.topic)}`
    );
    if (row.status === 'ACTION_REQUIRED') {
      console.log(
        '      ⚠ ACTION_REQUIRED sent to "all" — needs one named owner, not a broadcast.'
      );
    }
  }
}
