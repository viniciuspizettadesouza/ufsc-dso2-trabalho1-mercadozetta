import type { NextFunction, Request, Response } from 'express';
import { getAccountSecurityConfig } from '@/config/security';
import AppError from '@/errors/AppError';
import { clearAuthCookies } from '@/services/authCookieService';
import {
  GENERIC_ACCOUNT_REQUEST_RESPONSE,
  type AccountSecurityService,
} from '@/services/accountSecurityService';
import type {
  AccountRequestData,
  AccountTokenConfirmationData,
  PasswordResetConfirmationData,
} from '@/validators/accountSecurityValidator';

type ValidatedBodyRequest<TBody> = Request & {
  validated: { body: TBody };
};

type ControllerDependencies = {
  responseFloorMs?: () => number;
  nowMs?: () => number;
  wait?: (durationMs: number) => Promise<void>;
};

function deliveryUnavailable() {
  return new AppError(
    503,
    'ACCOUNT_DELIVERY_UNAVAILABLE',
    'Account message delivery is unavailable',
  );
}

export function createAccountSecurityController(
  service?: AccountSecurityService,
  dependencies: ControllerDependencies = {},
) {
  const responseFloorMs =
    dependencies.responseFloorMs ??
    (() => getAccountSecurityConfig().requestResponseFloorMs);
  const nowMs = dependencies.nowMs ?? Date.now;
  const wait =
    dependencies.wait ??
    ((durationMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, durationMs)));

  function getService() {
    if (!service) throw deliveryUnavailable();
    return service;
  }

  async function withResponseFloor<T>(operation: () => Promise<T>) {
    const startedAt = nowMs();
    try {
      return await operation();
    } finally {
      await wait(Math.max(0, responseFloorMs() - (nowMs() - startedAt)));
    }
  }

  return {
    requireDelivery(_req: Request, _res: Response, next: NextFunction) {
      return next(service ? undefined : deliveryUnavailable());
    },
    async requestEmailVerification(
      req: ValidatedBodyRequest<AccountRequestData>,
      res: Response,
    ) {
      await withResponseFloor(() =>
        getService().requestEmailVerification(
          req.validated.body,
          req.tenant!.id,
        ),
      );
      return res.status(202).send(GENERIC_ACCOUNT_REQUEST_RESPONSE);
    },
    async confirmEmailVerification(
      req: ValidatedBodyRequest<AccountTokenConfirmationData>,
      res: Response,
    ) {
      await getService().confirmEmailVerification(
        req.validated.body,
        req.tenant!.id,
      );
      return res.status(204).send();
    },
    async requestPasswordReset(
      req: ValidatedBodyRequest<AccountRequestData>,
      res: Response,
    ) {
      await withResponseFloor(() =>
        getService().requestPasswordReset(req.validated.body, req.tenant!.id),
      );
      return res.status(202).send(GENERIC_ACCOUNT_REQUEST_RESPONSE);
    },
    async confirmPasswordReset(
      req: ValidatedBodyRequest<PasswordResetConfirmationData>,
      res: Response,
    ) {
      await getService().confirmPasswordReset(
        req.validated.body,
        req.tenant!.id,
      );
      clearAuthCookies(res);
      return res.status(204).send();
    },
  };
}

export type AccountSecurityController = ReturnType<
  typeof createAccountSecurityController
>;
