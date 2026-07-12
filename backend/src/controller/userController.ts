import type { Request, Response } from 'express';
import UserService from '../services/userService';
import type { CreateUserData } from '../validators/userValidator';

type CreateUserRequest = Request & {
  validated: {
    body: CreateUserData;
  };
};

const userController = {
  async add(req: CreateUserRequest, res: Response) {
    const createdUser = await UserService.createUser(
      req.validated.body,
      req.tenant?.id ?? '',
    );
    return res.status(201).send({ newUser: createdUser });
  },

  async sellerProfile(req: Request<{ userId: string }>, res: Response) {
    const seller = await UserService.getPublicSellerProfile(
      req.params.userId,
      req.tenant?.id ?? '',
    );
    return res.status(200).send(seller);
  },
};

export default userController;
