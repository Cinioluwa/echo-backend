import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import http from 'http';

let serverProcess: any;

async function waitForServer(port: number, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkServer = () => {
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/healthz',
        method: 'GET'
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          checkAgain();
        }
      });

      req.on('error', () => {
        checkAgain();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        checkAgain();
      });

      req.end();
    };

    const checkAgain = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Server didn't start within ${timeout}ms`));
      } else {
        setTimeout(checkServer, 500);
      }
    };

    checkServer();
  });
}

export default async function globalSetup() {
  // Set up SQLite database for E2E tests
  const dbFile = `e2e-test-${randomUUID()}.db`;
  const dbUrl = `file:./${dbFile}`;
  process.env.DATABASE_URL = dbUrl;
  process.env.E2E_DB_FILE = dbFile;

  // Generate Prisma client for test schema
  // execSync('npx prisma generate --schema=prisma/test-schema.prisma', { stdio: 'inherit' });

  // Push schema to SQLite
  execSync('npx prisma db push --schema=prisma/test-schema.prisma --accept-data-loss --skip-generate', { stdio: 'inherit' });

  // Start the E2E server using tsx
  // Use npx to be cross-platform (works on Windows and Linux)
  serverProcess = spawn('npx', ['tsx', 'src/e2e-server.ts'], {
    stdio: 'pipe', // Change to pipe to avoid conflicts
    env: { ...process.env, NODE_ENV: 'test' },
    shell: true // Required for npx on Windows
  });

  // Wait for server to be ready
  try {
    await waitForServer(3000);
    console.log('E2E server is ready');
  } catch (error) {
    console.error('Failed to start E2E server:', error);
    serverProcess.kill();
    throw error;
  }

  return serverProcess;
}