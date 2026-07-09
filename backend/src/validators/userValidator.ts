import AppError from '../errors/AppError';
import type { RequestFieldValue } from '../types/request';

export type CreateUserRequestBody = {
  email?: RequestFieldValue;
  password?: RequestFieldValue;
  username?: RequestFieldValue;
  telephone?: RequestFieldValue;
};

export type CreateUserData = {
  email: string;
  password: string;
  username: string;
  telephone: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string) {
  return password.length >= 8;
}

export function validateCreateUserPayload(body: CreateUserRequestBody = {}): CreateUserData {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const username = String(body.username || '').trim();
  const telephone = String(body.telephone || '').trim();

  if (!email || !password || !username || !telephone)
    throw new AppError(400, 'MISSING_USER_FIELDS', 'Email, password, username and telephone are required');

  if (!isValidEmail(email))
    throw new AppError(400, 'INVALID_EMAIL', 'Invalid email');

  if (!isStrongPassword(password))
    throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters long');

  return {
    email,
    password,
    username,
    telephone,
  };
}
