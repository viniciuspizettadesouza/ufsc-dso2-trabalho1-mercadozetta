import type { Request, Response } from 'express';
import AppError from '../errors/AppError';
import ProductService from '../services/productService';

const productController = {
  async index(req: Request, res: Response) {
    const products = await ProductService.listProducts(req.tenant?.id ?? '', req.validated?.query ?? {});
    return res.status(200).send(products);
  },

  async detail(req: Request, res: Response) {
    const product = await ProductService.getProductById(req.validated?.params?.productId ?? '', req.tenant?.id ?? '');

    if (!product)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

    return res.status(200).send(product);
  },

  async add(req: Request, res: Response) {
    const newProduct = await ProductService.createProduct(req.validated?.body ?? {}, req.userId ?? '', req.tenant?.id ?? '');
    return res.status(201).send({ newProduct });
  },

  async listBySeller(req: Request, res: Response) {
    const products = await ProductService.listProductsBySeller(
      req.validated?.params?.userId ?? '',
      req.tenant?.id ?? '',
      req.validated?.query ?? {}
    );
    return res.status(200).send(products);
  },
};

export default productController;
