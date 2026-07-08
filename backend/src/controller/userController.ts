import type { Request, Response } from 'express';
import UserService from '../services/userService';

const userController = {
  async add(req: Request, res: Response) {
    const newUser = await UserService.createUser(req.validated?.body, req.tenant?.id ?? '');
    return res.status(201).send({ newUser });
  },

  async sellerProfile(req: Request, res: Response) {
    const seller = await UserService.getPublicSellerProfile(req.params.userId, req.tenant?.id ?? '');
    return res.status(200).send(seller);
  },
};

export default userController;
