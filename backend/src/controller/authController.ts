import type { Request, Response } from 'express';
import { getAuthCookieConfig } from '@/config/security';
import AppError from '@/errors/AppError';
import AuthService from '@/services/authService';
import { clearAuthCookies, setAuthCookies } from '@/services/authCookieService';
import {
  listSessions,
  revokeSession,
  rotateSession,
} from '@/services/sessionService';
import type { LoginCredentials } from '@/validators/authValidator';

type LoginRequest = Request & {
  validated: {
    body: LoginCredentials;
  };
};

const authController = {
  async authenticate(req: LoginRequest, res: Response) {
    const result = await AuthService.authenticate(
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
  /* v8 ignore next */
  async session(req: Request, res: Response) {
    /* v8 ignore else */
    if (!req.sessionId)
      throw new AppError(
        401,
        'COOKIE_SESSION_REQUIRED',
        'Cookie session is required',
      );

    const result = await AuthService.getSessionState(
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
      const result = await rotateSession(
        typeof refreshToken === 'string' ? refreshToken : '',
        req.tenant!.id,
        new Date(),
      );
      setAuthCookies(res, result);
      return res.status(204).send();
    } catch (error) {
      /* v8 ignore next */
      if (error instanceof AppError && error.statusCode === 401) {
        clearAuthCookies(res);
      }
      throw error;
    }
  },
  async sessions(req: Request, res: Response) {
    const sessions = await listSessions(
      req.userId!,
      req.tenant!.id,
      new Date(),
    );
    return res.status(200).send({ sessions });
  },
  async revokeSession(req: Request, res: Response) {
    const sessionId = String(req.params.sessionId);
    await revokeSession(
      sessionId,
      req.userId!,
      req.tenant!.id,
      'user_revoked',
      new Date(),
    );
    /* v8 ignore else */
    if (sessionId === req.sessionId) clearAuthCookies(res);
    return res.status(204).send();
  },
  async logoutCurrent(req: Request, res: Response) {
    /* v8 ignore next */
    if (!req.sessionId)
      throw new AppError(
        401,
        'COOKIE_SESSION_REQUIRED',
        'Cookie session is required',
      );

    await revokeSession(
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
    await AuthService.logout(req.userId!, req.tenant!.id);
    clearAuthCookies(res);
    return res.status(204).send();
  },
};

export default authController;
