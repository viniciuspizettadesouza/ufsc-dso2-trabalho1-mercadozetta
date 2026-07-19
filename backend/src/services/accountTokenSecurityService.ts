import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  getAccountTokenHashKeyRing,
  type SecretKeyRing,
} from '@/config/security';
import { isUuid } from '@/ids';
import type { AccountTokenPurpose } from '@/repositories/accountTokenRepository';

const TOKEN_SECRET_PATTERN = /^[A-Za-z\d_-]{43}$/;
const TOKEN_HASH_PATTERN = /^[a-f\d]{64}$/;

function hashWithSecret(
  token: string,
  tenantId: string,
  purpose: AccountTokenPurpose,
  secret: string,
) {
  return createHmac('sha256', secret)
    .update(`${tenantId}\0${purpose}\0${token}`)
    .digest('hex');
}

export function getAccountTokenSelector(token: string) {
  const [selector, secret, extra] = token.split('.');
  if (
    extra !== undefined ||
    !selector ||
    !isUuid(selector) ||
    !secret ||
    !TOKEN_SECRET_PATTERN.test(secret)
  )
    return null;
  return selector;
}

export function createAccountToken(
  tenantId: string,
  purpose: AccountTokenPurpose,
  ring: SecretKeyRing = getAccountTokenHashKeyRing(),
) {
  const selector = randomUUID();
  const token = `${selector}.${randomBytes(32).toString('base64url')}`;
  return {
    selector,
    token,
    tokenHash: hashWithSecret(
      token,
      tenantId,
      purpose,
      ring.keys[ring.activeVersion],
    ),
    tokenHashSecretVersion: ring.activeVersion,
  };
}

export function accountTokenMatches(
  token: string,
  tenantId: string,
  purpose: AccountTokenPurpose,
  expectedHash: string,
  secretVersion: string,
  ring: SecretKeyRing = getAccountTokenHashKeyRing(),
) {
  const secret = ring.keys[secretVersion];
  if (!secret || !TOKEN_HASH_PATTERN.test(expectedHash)) return false;

  const actual = Buffer.from(
    hashWithSecret(token, tenantId, purpose, secret),
    'hex',
  );
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
