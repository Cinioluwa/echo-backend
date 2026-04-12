import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestClient } from './appClient.js';
import './setupHooks.js';
import { cleanupTestData, createCategory, createOrganization, createUser } from '../fixtures/index.js';

describe('Anonymous Alias Profile Picture', () => {
  let client: any;
  let organization: any;
  let user: any;
  let token = '';
  let category: any;

  const aliasName = 'Campus Whisper';
  const aliasPicture = 'https://cdn.echo-ng.com/aliases/campus-whisper.png';

  beforeAll(async () => {
    client = await buildTestClient({ disableRateLimiting: true });

    organization = await createOrganization({
      name: 'Alias Picture Org',
      domain: 'aliaspic.edu',
    });

    user = await createUser({
      email: 'alias-user@aliaspic.edu',
      firstName: 'Alias',
      lastName: 'Owner',
      organizationId: organization.id,
      role: 'USER',
    });

    category = await createCategory({
      name: 'Alias Category',
      organizationId: organization.id,
    });

    const loginRes = await client
      .post('/api/users/login')
      .send({ email: user.email, password: 'Password123!' })
      .expect(200);

    token = loginRes.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('stores and returns alias profile picture in user preferences', async () => {
    const patchRes = await client
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        anonymousAlias: aliasName,
        anonymousAliasProfilePicture: aliasPicture,
      })
      .expect(200);

    expect(patchRes.body.anonymousAlias).toBe(aliasName);
    expect(patchRes.body.anonymousAliasProfilePicture).toBe(aliasPicture);

    const getRes = await client
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getRes.body.anonymousAlias).toBe(aliasName);
    expect(getRes.body.anonymousAliasProfilePicture).toBe(aliasPicture);
  });

  it('snapshots alias name and alias profile picture on anonymous ping creation', async () => {
    const pingRes = await client
      .post('/api/pings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Anonymous ping with avatar',
        content: 'Testing alias picture payload',
        categoryId: category.id,
        isAnonymous: true,
      })
      .expect(201);

    expect(pingRes.body.isAnonymous).toBe(true);
    expect(pingRes.body.author).toBeNull();
    expect(pingRes.body.anonymousAlias).toBe(aliasName);
    expect(pingRes.body.anonymousProfilePicture).toBe(aliasPicture);
  });

  it('snapshots alias name and alias profile picture on anonymous comments', async () => {
    const pingRes = await client
      .post('/api/pings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Parent ping for anonymous comment',
        content: 'Content',
        categoryId: category.id,
        isAnonymous: false,
      })
      .expect(201);

    const commentRes = await client
      .post(`/api/pings/${pingRes.body.id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'Anonymous comment with alias picture',
        isAnonymous: true,
      })
      .expect(201);

    expect(commentRes.body.isAnonymous).toBe(true);
    expect(commentRes.body.author).toBeNull();
    expect(commentRes.body.anonymousAlias).toBe(aliasName);
    expect(commentRes.body.anonymousProfilePicture).toBe(aliasPicture);
  });
});
