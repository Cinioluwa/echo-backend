import { test, expect } from '@playwright/test';

test.describe('Cross-Organization Data Isolation E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let org1AdminToken: string;
  let org1UserToken: string;
  let org2UserToken: string;
  let org1User: any;
  let org2User: any;
  let org1Ping: any;
  let org1Category: any;
  let org1Announcement: any;

  test.beforeAll(async ({ request }) => {
    // Setup: Get tokens for users from different organizations
    const org1AdminResponse = await request.post('/api/users/login', {
      data: {
        email: 'admin@testorg1.edu',
        password: 'password123'
      }
    });
    expect(org1AdminResponse.status()).toBe(200);
    const org1AdminData = await org1AdminResponse.json();
    org1AdminToken = org1AdminData.token;

    const org1UserResponse = await request.post('/api/users/login', {
      data: {
        email: 'user@testorg1.edu',
        password: 'password123'
      }
    });
    expect(org1UserResponse.status()).toBe(200);
    const org1UserData = await org1UserResponse.json();
    org1UserToken = org1UserData.token;

    const org1MeResponse = await request.get('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(org1MeResponse.status()).toBe(200);
    org1User = await org1MeResponse.json();

    const org2UserResponse = await request.post('/api/users/login', {
      data: {
        email: 'user@testorg2.edu',
        password: 'password123'
      }
    });
    expect(org2UserResponse.status()).toBe(200);
    const org2UserData = await org2UserResponse.json();
    org2UserToken = org2UserData.token;

    const org2MeResponse = await request.get('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2MeResponse.status()).toBe(200);
    org2User = await org2MeResponse.json();
  });

  test('organization data isolation for pings and categories', async ({ request }) => {
    // Step 1: Org1 user creates a category
    const categoryResponse = await request.post('/api/categories', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      },
      data: {
        name: 'Org1 Confidential Category'
      }
    });
    expect(categoryResponse.status()).toBe(201);
    org1Category = await categoryResponse.json();

    // Step 2: Org1 user creates a ping in that category
    const pingResponse = await request.post('/api/pings', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      },
      data: {
        title: 'Org1 Confidential Ping',
        content: 'This ping contains sensitive information for Organization 1 only.',
        categoryId: org1Category.id
      }
    });
    expect(pingResponse.status()).toBe(201);
    org1Ping = await pingResponse.json();

    // Step 3: Org1 user can see their own ping
    const org1PingsResponse = await request.get('/api/pings', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(org1PingsResponse.status()).toBe(200);
    const org1PingsPayload = await org1PingsResponse.json();
    const org1Pings = org1PingsPayload.data;
    const org1OwnPing = org1Pings.find((p: any) => p.id === org1Ping.id);
    expect(org1OwnPing).toBeTruthy();

    // Step 4: Org2 user cannot see Org1's ping
    const org2PingsResponse = await request.get('/api/pings', {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2PingsResponse.status()).toBe(200);
    const org2PingsPayload = await org2PingsResponse.json();
    const org2Pings = org2PingsPayload.data;
    const org2SeeingOrg1Ping = org2Pings.find((p: any) => p.id === org1Ping.id);
    expect(org2SeeingOrg1Ping).toBeFalsy();

    // Step 5: Org2 user cannot access Org1's ping directly
    const directAccessResponse = await request.get(`/api/pings/${org1Ping.id}`, {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(directAccessResponse.status()).toBe(404);

    // Step 6: Org1 user can see their own category
    const org1CategoriesResponse = await request.get('/api/categories', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(org1CategoriesResponse.status()).toBe(200);
    const org1CategoriesPayload = await org1CategoriesResponse.json();
    const org1Categories = org1CategoriesPayload.data;
    const org1OwnCategory = org1Categories.find((c: any) => c.id === org1Category.id);
    expect(org1OwnCategory).toBeTruthy();

    // Step 7: Org2 user cannot see Org1's category
    const org2CategoriesResponse = await request.get('/api/categories', {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2CategoriesResponse.status()).toBe(200);
    const org2CategoriesPayload = await org2CategoriesResponse.json();
    const org2Categories = org2CategoriesPayload.data;
    const org2SeeingOrg1Category = org2Categories.find((c: any) => c.id === org1Category.id);
    expect(org2SeeingOrg1Category).toBeFalsy();
  });

  test('organization data isolation for announcements', async ({ request }) => {
    // Step 1: Org1 admin creates an announcement
    const announcementResponse = await request.post('/api/admin/announcements', {
      headers: {
        'Authorization': `Bearer ${org1AdminToken}`
      },
      data: {
        title: 'Org1 Internal Announcement',
        content: 'This is an internal announcement for Organization 1 members only.',
        categoryIds: [org1Category.id]
      }
    });
    expect(announcementResponse.status()).toBe(201);
    org1Announcement = await announcementResponse.json();

    // Step 2: Org1 user can see the announcement
    const org1AnnouncementsResponse = await request.get('/api/announcements', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(org1AnnouncementsResponse.status()).toBe(200);
    const org1Announcements = await org1AnnouncementsResponse.json();
    const org1OwnAnnouncement = org1Announcements.find((a: any) => a.id === org1Announcement.id);
    expect(org1OwnAnnouncement).toBeTruthy();

    // Step 3: Org2 user cannot see Org1's announcement
    const org2AnnouncementsResponse = await request.get('/api/announcements', {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2AnnouncementsResponse.status()).toBe(200);
    const org2Announcements = await org2AnnouncementsResponse.json();
    const org2SeeingOrg1Announcement = org2Announcements.find((a: any) => a.id === org1Announcement.id);
    expect(org2SeeingOrg1Announcement).toBeFalsy();
  });

  test('organization data isolation for admin operations', async ({ request }) => {
    // Step 1: Org1 admin can see Org1 users
    const org1UsersResponse = await request.get('/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${org1AdminToken}`
      }
    });
    expect(org1UsersResponse.status()).toBe(200);
    const org1UsersPayload = await org1UsersResponse.json();
    const org1Users = Array.isArray(org1UsersPayload) ? org1UsersPayload : org1UsersPayload.data;
    const org1UserInList = org1Users.find((u: any) => u.id === org1User.id);
    expect(org1UserInList).toBeTruthy();

    // Step 2: Org1 admin cannot see Org2 users
    const org2UserInOrg1List = org1Users.find((u: any) => u.id === org2User.id);
    expect(org2UserInOrg1List).toBeFalsy();

    // Step 3: Org1 admin cannot modify Org2 user
    const crossOrgModifyResponse = await request.patch(`/api/admin/users/${org2User.id}/role`, {
      headers: {
        'Authorization': `Bearer ${org1AdminToken}`
      },
      data: {
        role: 'ADMIN'
      }
    });
    expect(crossOrgModifyResponse.status()).toBe(404);

    // Step 4: Org1 admin can see Org1 pings
    const org1PingsResponse = await request.get('/api/admin/pings', {
      headers: {
        'Authorization': `Bearer ${org1AdminToken}`
      }
    });
    expect(org1PingsResponse.status()).toBe(200);
    const org1AdminPingsPayload = await org1PingsResponse.json();
    const org1AdminPings = org1AdminPingsPayload.data;
    const org1PingInAdminList = org1AdminPings.find((p: any) => p.id === org1Ping.id);
    expect(org1PingInAdminList).toBeTruthy();

    // Step 5: Org1 admin can delete Org1 ping
    const deletePingResponse = await request.delete(`/api/admin/pings/${org1Ping.id}`, {
      headers: {
        'Authorization': `Bearer ${org1AdminToken}`
      }
    });
    expect(deletePingResponse.status()).toBe(204);

    // Step 6: Verify ping is deleted
    const verifyDeleteResponse = await request.get(`/api/pings/${org1Ping.id}`, {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(verifyDeleteResponse.status()).toBe(404);
  });

  test('organization data isolation for comments and surges', async ({ request }) => {
    // Step 1: Create a new ping for this test
    const newPingResponse = await request.post('/api/pings', {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      },
      data: {
        title: 'Cross-Org Isolation Test Ping',
        content: 'Testing that comments and surges are properly isolated.',
        categoryId: org1Category.id
      }
    });
    expect(newPingResponse.status()).toBe(201);
    const newPing = await newPingResponse.json();

    // Step 2: Org1 user adds a comment
    const commentResponse = await request.post(`/api/pings/${newPing.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      },
      data: {
        content: 'This is a comment from Org1 user.'
      }
    });
    expect(commentResponse.status()).toBe(201);
    const comment = await commentResponse.json();

    // Step 3: Org1 user can see their comment
    const org1CommentsResponse = await request.get(`/api/pings/${newPing.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(org1CommentsResponse.status()).toBe(200);
    const org1CommentsPayload = await org1CommentsResponse.json();
    const org1Comments = Array.isArray(org1CommentsPayload) ? org1CommentsPayload : org1CommentsPayload.data;
    expect(org1Comments).toHaveLength(1);
    expect(org1Comments[0].content).toBe('This is a comment from Org1 user.');

    // Step 4: Org2 user cannot see the comment (cannot even access the ping)
    const org2CommentAccessResponse = await request.get(`/api/pings/${newPing.id}/comments`, {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2CommentAccessResponse.status()).toBe(404);

    // Step 5: Org1 user adds a surge
    const surgeResponse = await request.post(`/api/pings/${newPing.id}/surge`, {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    expect(surgeResponse.status()).toBe(200);

    // Step 6: Org1 user can see the surge count
    const pingWithSurgeResponse = await request.get(`/api/pings/${newPing.id}`, {
      headers: {
        'Authorization': `Bearer ${org1UserToken}`
      }
    });
    const pingWithSurge = await pingWithSurgeResponse.json();
    expect(pingWithSurge.surgeCount).toBe(1);

    // Step 7: Org2 user cannot surge the ping (cannot access it)
    const org2SurgeResponse = await request.post(`/api/pings/${newPing.id}/surge`, {
      headers: {
        'Authorization': `Bearer ${org2UserToken}`
      }
    });
    expect(org2SurgeResponse.status()).toBe(404);
  });
});