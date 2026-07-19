import type { Request, Response } from 'express';
import AppError from '@/errors/AppError';
import type { ProductService } from '@/services/productService';
import type {
  CreateProductData,
  ProductInventoryUpdateData,
  ProductListFilters,
  ProductStatusUpdateData,
  UpdateProductData,
} from '@/validators/productValidator';

type ProductIdParams = { productId: string };
type SellerIdParams = { userId: string };

type ProductListRequest = Request & {
  validated: {
    query: ProductListFilters;
  };
};

type ProductDetailRequest = Request & {
  validated: {
    params: ProductIdParams;
  };
};

type CreateProductRequest = Request & {
  validated: {
    body: CreateProductData;
  };
};

type ProductMutationRequest<T> = Request & {
  validated: { params: ProductIdParams; body: T };
};

type SellerProductsRequest = Request & {
  validated: {
    params: SellerIdParams;
    query: ProductListFilters;
  };
};

export function createProductController(productService: ProductService) {
  return {
    async index(req: ProductListRequest, res: Response) {
      const products = await productService.listProducts(
        req.tenant?.id ?? '',
        req.validated.query,
      );
      return res.status(200).send(products);
    },

    async detail(req: ProductDetailRequest, res: Response) {
      const product = await productService.getProductById(
        req.validated.params.productId,
        req.tenant?.id ?? '',
      );

      if (!product)
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

      return res.status(200).send(product);
    },

    async add(req: CreateProductRequest, res: Response) {
      const createdProduct = await productService.createProduct(
        req.validated.body,
        req.userId ?? '',
        req.tenant?.id ?? '',
        req.idempotencyKey ?? '',
      );
      return res.status(201).send(createdProduct);
    },

    async listBySeller(req: SellerProductsRequest, res: Response) {
      const products = await productService.listProductsBySeller(
        req.validated.params.userId,
        req.tenant?.id ?? '',
        req.validated.query,
      );
      return res.status(200).send(products);
    },

    async update(
      req: ProductMutationRequest<UpdateProductData>,
      res: Response,
    ) {
      return res
        .status(200)
        .send(
          await productService.updateProduct(
            req.validated.params.productId,
            req.validated.body,
            req.userId ?? '',
            req.tenant?.id ?? '',
          ),
        );
    },

    async updateStatus(
      req: ProductMutationRequest<ProductStatusUpdateData>,
      res: Response,
    ) {
      return res
        .status(200)
        .send(
          await productService.updateProductStatus(
            req.validated.params.productId,
            req.validated.body,
            req.userId ?? '',
            req.tenant?.id ?? '',
          ),
        );
    },

    async updateInventory(
      req: ProductMutationRequest<ProductInventoryUpdateData>,
      res: Response,
    ) {
      return res
        .status(200)
        .send(
          await productService.updateProductInventory(
            req.validated.params.productId,
            req.validated.body,
            req.userId ?? '',
            req.tenant?.id ?? '',
          ),
        );
    },
  };
}

export type ProductController = ReturnType<typeof createProductController>;
