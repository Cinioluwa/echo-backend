import { existsSync, unlinkSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const E2E_SERVER_PID_FILE = '.e2e-server.pid';

export default async function globalTeardown() {
  // Stop the E2E server if we started one
  if (existsSync(E2E_SERVER_PID_FILE)) {
    try {
      const pid = Number(readFileSync(E2E_SERVER_PID_FILE, 'utf8').trim());
      if (Number.isFinite(pid)) {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        } else {
          process.kill(pid, 'SIGTERM');
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    try {
      unlinkSync(E2E_SERVER_PID_FILE);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Clean up the E2E database file
  if (process.env.E2E_DB_FILE && existsSync(process.env.E2E_DB_FILE)) {
    try {
      unlinkSync(process.env.E2E_DB_FILE);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}