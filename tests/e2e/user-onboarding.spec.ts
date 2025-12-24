import { test, expect } from '@playwright/test';

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
    const userData = await registerResponse.json();
    expect(userData).toHaveProperty('id');
    expect(userData.email).toContain('e2e-user');
    expect(userData.status).toBe('PENDING');

    // Step 2: Verify email (simulate email verification)
    // In a real scenario, this would involve checking email and clicking verification link
    // For E2E testing, we'll assume the verification process works

    // Step 3: Login with the new account
    const loginResponse = await request.post('/api/users/login', {
      data: {
        email: userData.email,
        password: 'TestPassword123!'
      }
    });

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('token');
    expect(loginData.user.email).toBe(userData.email);

    const token = loginData.token;

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
    const userPings = await userPingsResponse.json();
    const createdPing = userPings.find((p: any) => p.id === pingData.id);
    expect(createdPing).toBeTruthy();
    expect(createdPing.title).toBe('My first ping from E2E test');

    // Step 7: Create a surge on the ping
    const surgeResponse = await request.post(`/api/pings/${pingData.id}/surge`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(surgeResponse.status()).toBe(200);
    const surgeData = await surgeResponse.json();
    expect(surgeData.surgeCount).toBe(1);

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
    const comments = await pingCommentsResponse.json();
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('This is my first comment on my first ping!');

    // Step 10: Check user profile/stats
    const profileResponse = await request.get('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(profileResponse.status()).toBe(200);
    const profile = await profileResponse.json();
    expect(profile.email).toBe(userData.email);
    expect(profile.firstName).toBe('E2E');
    expect(profile.lastName).toBe('User');
  });
});