import AppError from '../errors/AppError';
import type { RequestFieldValue } from '../types/request';

export type LoginRequestBody = {
  email?: RequestFieldValue;
  password?: RequestFieldValue;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export function validateLoginPayload(body: LoginRequestBody = {}): LoginCredentials {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password)
    throw new AppError(400, 'MISSING_CREDENTIALS', 'Email and password are required');

  return { email, password };
}
