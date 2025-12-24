import { unlinkSync, existsSync } from 'fs';

export default async function globalTeardown() {
  // Clean up the E2E database file
  if (process.env.E2E_DB_FILE && existsSync(process.env.E2E_DB_FILE)) {
    try {
      unlinkSync(process.env.E2E_DB_FILE);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}