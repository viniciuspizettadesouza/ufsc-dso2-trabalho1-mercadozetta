import { z } from 'zod';
import 'zod-openapi';
import AppError from '@/errors/AppError';

type AppIssueParams = {
  appCode?: string;
  statusCode?: number;
};

export function requestString(value: unknown, fallback = '') {
  return String(value || fallback);
}

export function firstDefined(primary: unknown, fallback: unknown) {
  return primary ?? fallback;
}

export function hasRequestValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

export function parseAppSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const params =
    issue.code === 'custom'
      ? (issue.params as AppIssueParams | undefined)
      : undefined;

  throw new AppError(
    params?.statusCode ?? 400,
    params?.appCode ?? 'INVALID_REQUEST',
    issue.message,
  );
}
