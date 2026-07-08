import AppError from '../errors/AppError';

export function validateLoginPayload(body: Record<string, unknown> = {}) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password)
    throw new AppError(400, 'MISSING_CREDENTIALS', 'Email and password are required');

  return { email, password };
}
