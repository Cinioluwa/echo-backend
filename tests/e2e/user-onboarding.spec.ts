import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/test-client';

// Helper function to retry Prisma operations (handles race conditions)
async function retryPrismaOperation<T>(operation: () => Promise<T>, retries = 10, delay = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1}/${retries}...`);
      const result = await operation();
      console.log(`Success on attempt ${i + 1}`);
      return result;
    } catch (error: any) {
      console.log(`Attempt ${i + 1} failed:`, error.code, error.message);
      if (error.code === 'P2025' && i < retries - 1) {
        // Record not found - wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Retry limit exceeded');
}

const prisma = new PrismaClient({
  datasources: {
    testDb: {
      url: process.env.DATABASE_URL,
    },
  },
});

test.describe('User Registration & Onboarding E2E', () => {
  test('complete user registration and first ping creation journey', async ({ request }) => {
    // Step 1: Register a new user
    const registerResponse = await request.post('/api/users/register', {
      data: {
        email: `e2e-user-${Date.now()}@testorg1.edu`,
        password: 'TestPassword123!',
        firstName: 'E2E',
        lastName: 'User',
        level: 3
      }
    });

    expect(registerResponse.status()).toBe(201);
    const { user: userData } = await registerResponse.json();

    // Step 2: Manually activate user (with retry to handle timing issues)
    await retryPrismaOperation(() =>
      prisma.user.update({
        where: { id: userData.id },
        data: { status: 'ACTIVE', isVerified: true }
      })
    );

    // Step 3: Login with the new account
    const loginResponse = await request.post('/api/users/login', {
      data: {
        email: userData.email,
        password: 'TestPassword123!'
      }
    });

    expect(loginResponse.status()).toBe(200);
    const { token } = await loginResponse.json();

    // Verify user details via /me endpoint
    const profileResponse = await request.get('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(profileResponse.status()).toBe(200);
    const profile = await profileResponse.json();
    expect(profile.email).toBe(userData.email);

    // Step 4: Create a category for the ping
    const categoryResponse = await request.post('/api/categories', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        name: 'E2E Test Category'
      }
    });

    expect(categoryResponse.status()).toBe(201);
    const categoryData = await categoryResponse.json();

    // Step 5: Create first ping
    const pingResponse = await request.post('/api/pings', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        title: 'My first ping from E2E test',
        content: 'This is an end-to-end test of the complete user journey from registration to ping creation.',
        hashtag: '#e2e-test',
        categoryId: categoryData.id
      }
    });

    expect(pingResponse.status()).toBe(201);
    const pingData = await pingResponse.json();
    expect(pingData.title).toBe('My first ping from E2E test');
    expect(pingData.status).toBe('POSTED');
    expect(pingData.hashtag).toBe('#e2e-test');

    // Step 6: Verify ping appears in user's pings
    const userPingsResponse = await request.get('/api/pings', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(userPingsResponse.status()).toBe(200);
    const userPingsPayload = await userPingsResponse.json();
    const userPings = userPingsPayload.data;
    const createdPing = userPings.find((p: any) => p.id === pingData.id);
    expect(createdPing).toBeTruthy();
    expect(createdPing.title).toBe('My first ping from E2E test');

    // Step 7: Create a surge on the ping
    const surgeResponse = await request.post(`/api/pings/${pingData.id}/surge`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect([200, 201]).toContain(surgeResponse.status());
    const surgeData = await surgeResponse.json();
    expect(surgeData).toHaveProperty('surged');
    expect(surgeData.surged).toBe(true);

    // Verify surge count via ping details
    const pingAfterSurgeResponse = await request.get(`/api/pings/${pingData.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    expect(pingAfterSurgeResponse.status()).toBe(200);
    const pingAfterSurge = await pingAfterSurgeResponse.json();
    expect(pingAfterSurge.surgeCount).toBe(1);

    // Step 8: Add a comment to the ping
    const commentResponse = await request.post(`/api/pings/${pingData.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        content: 'This is my first comment on my first ping!'
      }
    });

    expect(commentResponse.status()).toBe(201);
    const commentData = await commentResponse.json();
    expect(commentData.content).toBe('This is my first comment on my first ping!');
    expect(commentData.author.id).toBe(userData.id);

    // Step 9: Verify comment appears in ping comments
    const pingCommentsResponse = await request.get(`/api/pings/${pingData.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(pingCommentsResponse.status()).toBe(200);
    const commentsPayload = await pingCommentsResponse.json();
    const comments = Array.isArray(commentsPayload) ? commentsPayload : commentsPayload.data;
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('This is my first comment on my first ping!');

    // Step 10: Check user profile/stats
    const profileResponse2 = await request.get('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(profileResponse2.status()).toBe(200);
    const profile2 = await profileResponse2.json();
    expect(profile2.email).toBe(userData.email);
    expect(profile2.firstName).toBe('E2E');
    expect(profile2.lastName).toBe('User');
  });
});