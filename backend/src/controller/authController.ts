import type { Request, Response } from 'express';
import AuthService from '../services/authService';
import type { LoginCredentials } from '../validators/authValidator';

type LoginRequest = Request & {
  validated: {
    body: LoginCredentials;
  };
};

const authController = {
  async authenticate(req: LoginRequest, res: Response) {
    const result = await AuthService.authenticate(
      req.validated.body,
      req.tenant?.id ?? '',
    );
    return res.status(200).send(result);
  },
  async logout(req: Request, res: Response) {
    await AuthService.logout(req.userId ?? '', req.tenant?.id ?? '');
    return res.status(204).send();
  },
};

export default authController;
