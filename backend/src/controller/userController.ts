import type { Request, Response } from 'express';
import type { UserService } from '@/services/userService';
import type { CreateUserData } from '@/validators/userValidator';

type CreateUserRequest = Request & {
  validated: {
    body: CreateUserData;
  };
};

export function createUserController(userService: UserService) {
  return {
    async add(req: CreateUserRequest, res: Response) {
      const createdUser = await userService.createUser(
        req.validated.body,
        req.tenant?.id ?? '',
      );
      return res.status(201).send({ newUser: createdUser });
    },

    async sellerProfile(req: Request<{ userId: string }>, res: Response) {
      const seller = await userService.getPublicSellerProfile(
        req.params.userId,
        req.tenant?.id ?? '',
      );
      return res.status(200).send(seller);
    },
  };
}

export type UserController = ReturnType<typeof createUserController>;
