import { isAxiosError } from 'axios';

type ApiErrorBody = { code?: string; error?: string };

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
  codeMessages: Readonly<Record<string, string>> = {},
) {
  if (!isAxiosError<ApiErrorBody>(error)) return fallback;

  const body = error.response?.data;
  if (body?.code && codeMessages[body.code]) return codeMessages[body.code];
  return body?.error || fallback;
}
