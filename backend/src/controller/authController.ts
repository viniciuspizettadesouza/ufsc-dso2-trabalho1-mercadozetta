import type { Request, Response } from 'express';
import { getAuthCookieConfig } from '@/config/security';
import AppError from '@/errors/AppError';
import type { AuthService } from '@/services/authService';
import { clearAuthCookies, setAuthCookies } from '@/services/authCookieService';
import type { SessionService } from '@/services/sessionService';
import type { LoginCredentials } from '@/validators/authValidator';

type LoginRequest = Request & {
  validated: {
    body: LoginCredentials;
  };
};

type SessionServiceContract = Pick<
  SessionService,
  'listSessions' | 'revokeSession' | 'rotateSession'
>;

export function createAuthController(
  authService: AuthService,
  sessionService: SessionServiceContract,
) {
  return {
    async authenticate(req: LoginRequest, res: Response) {
      const result = await authService.authenticate(
        req.validated.body,
        req.tenant!.id,
        req.get('user-agent'),
      );
      setAuthCookies(res, result);
      return res.status(200).send({
        user: result.user,
        session: result.session,
      });
    },
    async session(req: Request, res: Response) {
      if (!req.sessionId)
        throw new AppError(
          401,
          'COOKIE_SESSION_REQUIRED',
          'Cookie session is required',
        );

      const result = await authService.getSessionState(
        req.sessionId,
        req.userId!,
        req.tenant!.id,
      );
      return res.status(200).send(result);
    },
    async refresh(req: Request, res: Response) {
      const cookies = getAuthCookieConfig();
      const refreshToken = req.cookies[cookies.refresh.name];

      try {
        const result = await sessionService.rotateSession(
          typeof refreshToken === 'string' ? refreshToken : '',
          req.tenant!.id,
          new Date(),
        );
        setAuthCookies(res, result);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 401) {
          clearAuthCookies(res);
        }
        throw error;
      }
    },
    async sessions(req: Request, res: Response) {
      const sessions = await sessionService.listSessions(
        req.userId!,
        req.tenant!.id,
        new Date(),
      );
      return res.status(200).send({ sessions });
    },
    async revokeSession(req: Request, res: Response) {
      const sessionId = String(req.params.sessionId);
      await sessionService.revokeSession(
        sessionId,
        req.userId!,
        req.tenant!.id,
        'user_revoked',
        new Date(),
      );
      if (sessionId === req.sessionId) clearAuthCookies(res);
      return res.status(204).send();
    },
    async logoutCurrent(req: Request, res: Response) {
      if (!req.sessionId)
        throw new AppError(
          401,
          'COOKIE_SESSION_REQUIRED',
          'Cookie session is required',
        );

      await sessionService.revokeSession(
        req.sessionId,
        req.userId!,
        req.tenant!.id,
        'current_session_logout',
        new Date(),
      );
      clearAuthCookies(res);
      return res.status(204).send();
    },
    async logout(req: Request, res: Response) {
      await authService.logout(req.userId!, req.tenant!.id);
      clearAuthCookies(res);
      return res.status(204).send();
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
