import type { Request, Response } from 'express';
import AuthService from '../services/authService';

const authController = {
  async authenticate(req: Request, res: Response) {
    const result = await AuthService.authenticate(req.validated?.body ?? {}, req.tenant?.id ?? '');
    return res.status(200).send(result);
  },
};

export default authController;
