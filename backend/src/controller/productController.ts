import type { Request, Response } from 'express';
import AppError from '@/errors/AppError';
import type { ProductService } from '@/services/productService';
import type {
  CreateProductData,
  ProductListFilters,
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
      );
      return res.status(201).send({ newProduct: createdProduct });
    },

    async listBySeller(req: SellerProductsRequest, res: Response) {
      const products = await productService.listProductsBySeller(
        req.validated.params.userId,
        req.tenant?.id ?? '',
        req.validated.query,
      );
      return res.status(200).send(products);
    },
  };
}

export type ProductController = ReturnType<typeof createProductController>;
