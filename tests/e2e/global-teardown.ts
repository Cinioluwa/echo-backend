import { execSync } from 'child_process';

export default async function globalTeardown() {
  // Clean up the E2E database file
  if (process.env.E2E_DB_FILE) {
    try {
      execSync(`del ${process.env.E2E_DB_FILE} 2>nul`, { stdio: 'inherit' });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}