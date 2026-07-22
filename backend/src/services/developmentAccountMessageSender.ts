import { logger } from '@/logging';
import type {
  AccountMessage,
  AccountMessageSender,
} from '@/services/accountMessageSender';

function confirmationPath(message: AccountMessage) {
  if (message.kind === 'email_verification')
    return '/email-verification/confirm';
  if (message.kind === 'email_change') return '/account/email-change/confirm';
  if (message.kind === 'password_reset') return '/password-reset/confirm';
  return null;
}

function tokenLocation(path: string, token: string) {
  return `${path}#token=${encodeURIComponent(token)}`;
}

export function createDevelopmentAccountMessageSender(frontendOrigin: string) {
  const origin = frontendOrigin.replace(/\/$/, '');
  return {
    async enqueue(message) {
      const path = confirmationPath(message);
      logger.info({
        event: 'development_account_message',
        kind: message.kind,
        tenantId: message.tenantId,
        userId: message.userId,
        ...(path && 'token' in message
          ? {
              deliveryUrl: `${origin}${tokenLocation(path, message.token)}`,
            }
          : {}),
      });
    },
  } satisfies AccountMessageSender;
}
