import { test, expect } from '@playwright/test';

test.describe('Ping Lifecycle E2E', () => {
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let testCategory: any;
  let testPing: any;

  test.beforeAll(async ({ request }) => {
    // Setup: Create test user and admin, get tokens
    const userResponse = await request.post('/api/users/login', {
      data: {
        email: 'user@testorg1.edu',
        password: 'password123'
      }
    });
    expect(userResponse.status()).toBe(200);
    const userData = await userResponse.json();
    userToken = userData.token;
    testUser = userData.user;

    const adminResponse = await request.post('/api/users/login', {
      data: {
        email: 'admin@testorg1.edu',
        password: 'password123'
      }
    });
    expect(adminResponse.status()).toBe(200);
    const adminData = await adminResponse.json();
    adminToken = adminData.token;

    // Create a test category
    const categoryResponse = await request.post('/api/categories', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      data: {
        name: 'E2E Ping Lifecycle Category'
      }
    });
    expect(categoryResponse.status()).toBe(201);
    testCategory = await categoryResponse.json();
  });

  test('complete ping lifecycle from creation to resolution', async ({ request }) => {
    // Step 1: User creates a ping
    const pingResponse = await request.post('/api/pings', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      data: {
        title: 'Urgent: Server outage affecting students',
        content: 'The main application server is down and students cannot access their assignments. This is affecting the entire campus.',
        hashtag: '#server-outage',
        categoryId: testCategory.id
      }
    });

    expect(pingResponse.status()).toBe(201);
    testPing = await pingResponse.json();
    expect(testPing.status).toBe('POSTED');
    expect(testPing.progressStatus).toBe('NONE');

    // Step 2: Multiple users surge the ping (simulate community support)
    // Create additional users and have them surge
    for (let i = 0; i < 3; i++) {
      const surgeResponse = await request.post(`/api/pings/${testPing.id}/surge`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      expect(surgeResponse.status()).toBe(200);
    }

    // Verify surge count increased
    const pingAfterSurge = await request.get(`/api/pings/${testPing.id}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const pingData = await pingAfterSurge.json();
    expect(pingData.surgeCount).toBeGreaterThanOrEqual(3);

    // Step 3: Community discussion - add comments
    const comments = [
      'This is really affecting my final project deadline!',
      'Same here, I cannot submit my assignment.',
      'IT department has been notified, but no ETA yet.',
      'This has been happening intermittently all week.'
    ];

    for (const commentText of comments) {
      const commentResponse = await request.post(`/api/pings/${testPing.id}/comments`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        },
        data: {
          content: commentText
        }
      });
      expect(commentResponse.status()).toBe(201);
    }

    // Step 4: Admin reviews and updates progress status
    const progressResponse = await request.patch(`/api/admin/pings/${testPing.id}/progress-status`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        status: 'IN_PROGRESS'
      }
    });
    expect(progressResponse.status()).toBe(200);

    // Step 5: Admin adds official response
    const officialResponse = await request.post(`/api/pings/${testPing.id}/official-response`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        content: 'IT department has identified the issue. Server maintenance is underway and should be resolved within 2 hours. We apologize for the inconvenience.',
        isResolved: false
      }
    });
    expect(officialResponse.status()).toBe(201);

    // Step 6: Verify official response appears in ping
    const pingWithResponse = await request.get(`/api/pings/${testPing.id}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const updatedPing = await pingWithResponse.json();
    expect(updatedPing.officialResponse).toBeTruthy();
    expect(updatedPing.officialResponse.content).toContain('Server maintenance is underway');

    // Step 7: Admin marks issue as resolved
    const resolveResponse = await request.patch(`/api/pings/${testPing.id}/official-response`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        content: 'Issue has been resolved. Server is back online and all services are functioning normally.',
        isResolved: true
      }
    });
    expect(resolveResponse.status()).toBe(200);

    // Step 8: Verify final state
    const finalPingResponse = await request.get(`/api/pings/${testPing.id}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const finalPing = await finalPingResponse.json();
    expect(finalPing.officialResponse.isResolved).toBe(true);
    expect(finalPing.progressStatus).toBe('IN_PROGRESS');

    // Step 9: Community feedback on resolution
    const resolutionComment = await request.post(`/api/pings/${testPing.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      data: {
        content: 'Thank you for the quick resolution! Everything is working now.'
      }
    });
    expect(resolutionComment.status()).toBe(201);

    // Step 10: Verify complete ping data
    const completePingResponse = await request.get(`/api/pings/${testPing.id}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    const completePing = await completePingResponse.json();

    expect(completePing.title).toBe('Urgent: Server outage affecting students');
    expect(completePing.surgeCount).toBeGreaterThanOrEqual(3);
    expect(completePing.comments).toHaveLength(5); // 4 initial + 1 resolution comment
    expect(completePing.officialResponse.isResolved).toBe(true);
    expect(completePing.progressStatus).toBe('IN_PROGRESS');
  });
});