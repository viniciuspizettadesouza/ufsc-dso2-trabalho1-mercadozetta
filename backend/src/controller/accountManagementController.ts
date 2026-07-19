import type { NextFunction, Request, Response } from 'express';
import AppError from '@/errors/AppError';
import { clearAuthCookies } from '@/services/authCookieService';
import type { AccountDeactivationService } from '@/services/accountDeactivationService';
import type { AccountManagementService } from '@/services/accountManagementService';
import {
  EMAIL_CHANGE_REQUEST_RESPONSE,
  type EmailChangeService,
} from '@/services/emailChangeService';
import type {
  AccountDeactivationData,
  EmailChangeRequestData,
  PasswordChangeData,
  ProfileUpdateData,
} from '@/validators/accountManagementValidator';
import type { AccountTokenConfirmationData } from '@/validators/accountSecurityValidator';

type ValidatedBodyRequest<TBody> = Request & {
  validated: { body: TBody };
};

function deliveryUnavailable() {
  return new AppError(
    503,
    'ACCOUNT_DELIVERY_UNAVAILABLE',
    'Account message delivery is unavailable',
  );
}

export function createAccountManagementController(
  accountManagement: AccountManagementService,
  deactivation: AccountDeactivationService,
  emailChange?: EmailChangeService,
) {
  function getEmailChangeService() {
    if (!emailChange) throw deliveryUnavailable();
    return emailChange;
  }

  return {
    requireEmailDelivery(_req: Request, _res: Response, next: NextFunction) {
      return next(emailChange ? undefined : deliveryUnavailable());
    },
    async updateProfile(
      req: ValidatedBodyRequest<ProfileUpdateData>,
      res: Response,
    ) {
      const user = await accountManagement.updateProfile(
        req.validated.body,
        req.userId!,
        req.tenant!.id,
      );
      return res.status(200).send(user);
    },
    async changePassword(
      req: ValidatedBodyRequest<PasswordChangeData>,
      res: Response,
    ) {
      await accountManagement.changePassword(
        req.validated.body,
        req.userId!,
        req.tenant!.id,
      );
      clearAuthCookies(res);
      return res.status(204).send();
    },
    async requestEmailChange(
      req: ValidatedBodyRequest<EmailChangeRequestData>,
      res: Response,
    ) {
      await getEmailChangeService().requestEmailChange(
        req.validated.body,
        req.userId!,
        req.tenant!.id,
      );
      return res.status(202).send(EMAIL_CHANGE_REQUEST_RESPONSE);
    },
    async confirmEmailChange(
      req: ValidatedBodyRequest<AccountTokenConfirmationData>,
      res: Response,
    ) {
      await getEmailChangeService().confirmEmailChange(
        req.validated.body,
        req.tenant!.id,
      );
      clearAuthCookies(res);
      return res.status(204).send();
    },
    async deactivateAccount(
      req: ValidatedBodyRequest<AccountDeactivationData>,
      res: Response,
    ) {
      await deactivation.deactivateAccount(
        req.validated.body,
        req.userId!,
        req.tenant!.id,
      );
      clearAuthCookies(res);
      return res.status(204).send();
    },
  };
}

export type AccountManagementController = ReturnType<
  typeof createAccountManagementController
>;
