import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '@/app';
import Session from '@/model/session';
import User from '@/model/user';
import { createSession, rotateSession } from '@/services/sessionService';
import {
  clearDatabase,
  connectDatabase,
  disconnectDatabase,
} from './helpers/database';

function cookieValue(setCookie: string | string[] | undefined, name: string) {
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : setCookie
      ? [setCookie]
      : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return cookie?.split(';', 1)[0].slice(name.length + 1);
}

async function createUser(
  tenantId = 'mercadozetta',
  email = 'session@example.com',
) {
  return User.create({
    tenantId,
    email,
    password: 'password123',
    username: 'Session User',
    telephone: '555-0102',
  });
}

describe('cookie session authentication persistence', () => {
  beforeAll(connectDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectDatabase);

  it('creates cookie credentials at login, restores the session, and rotates refresh tokens', async () => {
    await createUser();
    const agent = request.agent(app);
    const login = await agent
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'session@example.com', password: 'password123' })
      .expect(200);

    expect(login.body.token).toBeUndefined();
    expect(login.body.session.id).toEqual(expect.any(String));
    expect(login.body.accessToken).toBeUndefined();
    expect(login.body.refreshToken).toBeUndefined();
    expect(login.body.csrfToken).toBeUndefined();
    const accessToken = cookieValue(login.headers['set-cookie'], 'mz_at');
    expect(accessToken).toBeTruthy();
    expect(jwt.decode(accessToken!, { complete: true })?.header.kid).toBe(
      'current',
    );
    expect(cookieValue(login.headers['set-cookie'], 'mz_rt')).toBeTruthy();
    const csrfToken = cookieValue(login.headers['set-cookie'], 'mz_csrf');
    expect(csrfToken).toBeTruthy();

    const restored = await agent.get('/auth/session').expect(200);
    expect(restored.body.user.email).toBe('session@example.com');
    expect(restored.body.session.id).toBe(login.body.session.id);

    const refresh = await agent
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', csrfToken!)
      .expect(204);
    expect(cookieValue(refresh.headers['set-cookie'], 'mz_at')).toBeTruthy();
    expect(cookieValue(refresh.headers['set-cookie'], 'mz_rt')).toBeTruthy();
    expect(cookieValue(refresh.headers['set-cookie'], 'mz_csrf')).toBeTruthy();

    const session = await Session.findById(login.body.session.id).select(
      '+refreshTokenHash +previousRefreshTokenHash',
    );
    expect(session?.rotationCounter).toBe(1);
    expect(session?.refreshTokenHash).toEqual(expect.any(String));
    expect(session?.refreshTokenSecretVersion).toBe('current');
    expect(session?.previousRefreshTokenHash).toEqual(expect.any(String));
    expect(session?.previousRefreshTokenSecretVersion).toBe('current');
  });

  it('allows one concurrent refresh winner without revoking the family', async () => {
    const user = await createUser();
    const now = new Date('2026-07-15T12:00:00.000Z');
    const created = await createSession(
      String(user._id),
      'mercadozetta',
      0,
      'integration browser',
      now,
    );
    const refreshAt = new Date(now.getTime() + 1000);

    const results = await Promise.allSettled([
      rotateSession(created.refreshToken, 'mercadozetta', refreshAt),
      rotateSession(created.refreshToken, 'mercadozetta', refreshAt),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      reason: { statusCode: 409, code: 'REFRESH_ALREADY_ROTATED' },
    });
    expect((await Session.findById(created.session.id))?.revokedAt).toBeFalsy();
  });

  it('revokes a family when the previous refresh token is replayed after the concurrency window', async () => {
    const user = await createUser();
    const now = new Date('2026-07-15T12:00:00.000Z');
    const created = await createSession(
      String(user._id),
      'mercadozetta',
      0,
      undefined,
      now,
    );
    await rotateSession(
      created.refreshToken,
      'mercadozetta',
      new Date(now.getTime() + 1000),
    );

    await expect(
      rotateSession(
        created.refreshToken,
        'mercadozetta',
        new Date(now.getTime() + 7000),
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_REUSED',
    });
    expect(await Session.findById(created.session.id)).toMatchObject({
      revokeReason: 'refresh_reuse',
      revokedAt: expect.any(Date),
    });
  });

  it('rejects wrong-tenant and expired refresh attempts without exposing session data', async () => {
    const user = await createUser();
    const now = new Date('2026-07-15T12:00:00.000Z');
    const created = await createSession(
      String(user._id),
      'mercadozetta',
      0,
      undefined,
      now,
    );

    await expect(
      rotateSession(created.refreshToken, 'campus-market', now),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });

    await Session.updateOne(
      { _id: created.session.id, tenantId: 'mercadozetta' },
      { $set: { expiresAt: new Date(now.getTime() - 1) } },
    );
    await expect(
      rotateSession(created.refreshToken, 'mercadozetta', now),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_EXPIRED',
    });
  });
});
