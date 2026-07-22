import type { Request, Response } from 'express';

import type { DeliveryAddressService } from '@/services/deliveryAddressService';
import type { DeliveryAddressData } from '@/validators/deliveryValidator';

const context = (req: Request) => ({
  tenantId: req.tenant?.id ?? '',
  userId: req.userId ?? '',
});

export function createDeliveryAddressController(
  service: DeliveryAddressService,
) {
  return {
    async list(req: Request, res: Response) {
      const { tenantId, userId } = context(req);
      res.send(await service.list(tenantId, userId));
    },
    async create(req: Request, res: Response) {
      const { tenantId, userId } = context(req);
      res
        .status(201)
        .send(
          await service.create(
            tenantId,
            userId,
            req.validated?.body as DeliveryAddressData,
          ),
        );
    },
    async update(req: Request, res: Response) {
      const { tenantId, userId } = context(req);
      res.send(
        await service.update(
          tenantId,
          userId,
          (req.validated?.params as { addressId: string }).addressId,
          req.validated?.body as DeliveryAddressData,
        ),
      );
    },
    async delete(req: Request, res: Response) {
      const { tenantId, userId } = context(req);
      await service.delete(
        tenantId,
        userId,
        (req.validated?.params as { addressId: string }).addressId,
      );
      res.status(204).send();
    },
  };
}

export type DeliveryAddressController = ReturnType<
  typeof createDeliveryAddressController
>;
