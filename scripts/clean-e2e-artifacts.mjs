import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const searchDirs = [repoRoot, path.join(repoRoot, 'prisma')];

const patterns = [
  // Debug/test output files we generate locally
  /^test_output.*\.txt$/,

  // Per-run E2E SQLite DBs
  /^e2e-test-.*\.db$/,
  /^e2e-test-.*\.db-(wal|shm)$/,
  /^e2e-test-.*\.db-journal$/,
];

function matchesAnyPattern(fileName) {
  return patterns.some((re) => re.test(fileName));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const candidates = [];
  for (const dir of searchDirs) {
    let dirEntries;
    try {
      dirEntries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      // If the directory doesn't exist, skip it.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }

    for (const entry of dirEntries) {
      if (!entry.isFile()) continue;
      if (!matchesAnyPattern(entry.name)) continue;
      candidates.push({ dir, name: entry.name });
    }
  }

  if (candidates.length === 0) {
    console.log('No E2E artifacts found to delete.');
    return;
  }

  if (dryRun) {
    console.log('Dry run: would delete:');
    for (const c of candidates) console.log(`- ${path.relative(repoRoot, path.join(c.dir, c.name))}`);
    return;
  }

  let deleted = 0;
  for (const c of candidates) {
    const fullPath = path.join(c.dir, c.name);
    try {
      await unlink(fullPath);
      deleted += 1;
    } catch (error) {
      // If it disappeared between listing and delete, ignore.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
  }

  console.log(`Deleted ${deleted} artifact file(s).`);
}

main().catch((err) => {
  console.error('Failed to clean E2E artifacts:', err);
  process.exitCode = 1;
});
