import type { Request, Response } from 'express';
import type { UserService } from '@/services/userService';
import type { CreateUserData } from '@/validators/userValidator';

type CreateUserRequest = Request & {
  validated: {
    body: CreateUserData;
  };
};

type SellerProfileRequest = Request & {
  validated: { params: { userId: string } };
};

export function createUserController(userService: UserService) {
  return {
    async add(req: CreateUserRequest, res: Response) {
      const createdUser = await userService.createUser(
        req.validated.body,
        req.tenant?.id ?? '',
      );
      return res.status(201).send(createdUser);
    },

    async sellerProfile(req: SellerProfileRequest, res: Response) {
      const seller = await userService.getPublicSellerProfile(
        req.validated.params.userId,
        req.tenant?.id ?? '',
      );
      return res.status(200).send(seller);
    },
  };
}

export type UserController = ReturnType<typeof createUserController>;
