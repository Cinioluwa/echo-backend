import { test, expect } from '@playwright/test';

test.describe('Admin Management E2E', () => {
  let adminToken: string;
  let regularUserToken: string;
  let testUser: any;
  let testAnnouncement: any;

  test.beforeAll(async ({ request }) => {
    // Setup: Get admin token
    const adminResponse = await request.post('/api/users/login', {
      data: {
        email: 'admin@testorg1.edu',
        password: 'password123'
      }
    });
    expect(adminResponse.status()).toBe(200);
    const adminData = await adminResponse.json();
    adminToken = adminData.token;

    // Get regular user token
    const userResponse = await request.post('/api/users/login', {
      data: {
        email: 'user@testorg1.edu',
        password: 'password123'
      }
    });
    expect(userResponse.status()).toBe(200);
    const userData = await userResponse.json();
    regularUserToken = userData.token;

    const meResponse = await request.get('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    expect(meResponse.status()).toBe(200);
    testUser = await meResponse.json();
  });

  test('admin platform management and user oversight', async ({ request }) => {
    // Step 1: Admin views platform statistics
    const statsResponse = await request.get('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(statsResponse.status()).toBe(200);
    const stats = await statsResponse.json();
    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('totalPings');
    expect(stats).toHaveProperty('totalOrganizations');

    // Step 2: Admin views all users in organization
    const usersResponse = await request.get('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(usersResponse.status()).toBe(200);
    const usersPayload = await usersResponse.json();
    const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.data;
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);

    // Find our test user
    const foundUser = users.find((u: any) => u.id === testUser.id);
    expect(foundUser).toBeTruthy();
    expect(foundUser.role).toBe('USER');

    // Step 3: Admin promotes user to representative
    const promoteResponse = await request.patch(`/api/admin/users/${testUser.id}/role`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        role: 'REPRESENTATIVE'
      }
    });
    expect(promoteResponse.status()).toBe(200);
    const promotedUser = await promoteResponse.json();
    expect(promotedUser.role).toBe('REPRESENTATIVE');

    // Step 4: Admin views analytics by level
    const levelAnalyticsResponse = await request.get('/api/admin/analytics/by-level', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(levelAnalyticsResponse.status()).toBe(200);
    const levelAnalytics = await levelAnalyticsResponse.json();
    expect(Array.isArray(levelAnalytics)).toBe(true);

    // Step 5: Admin views analytics by category
    const categoryAnalyticsResponse = await request.get('/api/admin/analytics/by-category', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(categoryAnalyticsResponse.status()).toBe(200);
    const categoryAnalytics = await categoryAnalyticsResponse.json();
    expect(Array.isArray(categoryAnalytics)).toBe(true);

    // Step 6: Admin creates organization-wide announcement
    const announcementResponse = await request.post('/api/admin/announcements', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        title: 'Scheduled Maintenance Notice',
        content: 'The platform will undergo scheduled maintenance this weekend from 2 AM to 4 AM EST. Some services may be temporarily unavailable.',
        categoryIds: [] // Organization-wide announcement
      }
    });
    expect(announcementResponse.status()).toBe(201);
    testAnnouncement = await announcementResponse.json();
    expect(testAnnouncement.title).toBe('Scheduled Maintenance Notice');

    // Step 7: Regular user can view the announcement
    const userAnnouncementsResponse = await request.get('/api/announcements', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    expect(userAnnouncementsResponse.status()).toBe(200);
    const userAnnouncementsPayload = await userAnnouncementsResponse.json();
    const userAnnouncements = Array.isArray(userAnnouncementsPayload)
      ? userAnnouncementsPayload
      : userAnnouncementsPayload.data;
    const foundAnnouncement = userAnnouncements.find((a: any) => a.id === testAnnouncement.id);
    expect(foundAnnouncement).toBeTruthy();
    expect(foundAnnouncement.title).toBe('Scheduled Maintenance Notice');

    // Step 8: Admin updates the announcement
    const updateResponse = await request.patch(`/api/admin/announcements/${testAnnouncement.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      data: {
        title: 'Updated: Scheduled Maintenance Notice',
        content: 'UPDATE: Maintenance window extended to 3 hours. Platform will be unavailable from 2 AM to 5 AM EST.'
      }
    });
    expect(updateResponse.status()).toBe(200);
    const updatedAnnouncement = await updateResponse.json();
    expect(updatedAnnouncement.title).toBe('Updated: Scheduled Maintenance Notice');
    expect(updatedAnnouncement.content).toContain('5 AM EST');

    // Step 9: Admin views all pings for moderation
    const allPingsResponse = await request.get('/api/admin/pings', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(allPingsResponse.status()).toBe(200);
    const allPingsPayload = await allPingsResponse.json();
    const allPings = Array.isArray(allPingsPayload) ? allPingsPayload : allPingsPayload.data;
    expect(Array.isArray(allPings)).toBe(true);

    // Step 10: Admin deletes the announcement (cleanup)
    const deleteResponse = await request.delete(`/api/admin/announcements/${testAnnouncement.id}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    expect(deleteResponse.status()).toBe(204);

    // Verify announcement is deleted
    const verifyDeleteResponse = await request.get('/api/announcements', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    const announcementsAfterDeletePayload = await verifyDeleteResponse.json();
    const announcementsAfterDelete = Array.isArray(announcementsAfterDeletePayload)
      ? announcementsAfterDeletePayload
      : announcementsAfterDeletePayload.data;
    const deletedAnnouncement = announcementsAfterDelete.find((a: any) => a.id === testAnnouncement.id);
    expect(deletedAnnouncement).toBeFalsy();
  });

  test('admin access control validation', async ({ request }) => {
    // Step 1: Regular user cannot access admin endpoints
    const adminStatsResponse = await request.get('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    expect(adminStatsResponse.status()).toBe(403);

    // Step 2: Regular user cannot access admin user management
    const adminUsersResponse = await request.get('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    expect(adminUsersResponse.status()).toBe(403);

    // Step 3: Regular user cannot access admin analytics
    const adminAnalyticsResponse = await request.get('/api/admin/analytics/by-level', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      }
    });
    expect(adminAnalyticsResponse.status()).toBe(403);

    // Step 4: Regular user cannot create admin announcements
    const adminAnnouncementResponse = await request.post('/api/admin/announcements', {
      headers: {
        'Authorization': `Bearer ${regularUserToken}`
      },
      data: {
        title: 'Unauthorized Announcement',
        content: 'This should not work'
      }
    });
    expect(adminAnnouncementResponse.status()).toBe(403);

    // Step 5: Unauthenticated requests are rejected
    const unauthResponse = await request.get('/api/admin/stats');
    expect(unauthResponse.status()).toBe(401);
  });
});