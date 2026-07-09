import type { Request, Response, NextFunction, RequestHandler } from 'express';

type HandlerResult = void | Response | Promise<void | Response>;

type AsyncRequestHandler<TRequest extends Request = Request> = (
  req: TRequest,
  res: Response,
  next: NextFunction
) => HandlerResult;

function asyncHandler<TRequest extends Request = Request>(handler: AsyncRequestHandler<TRequest>): RequestHandler {
  return function wrappedHandler(req: Request, res: Response, next: NextFunction) {
    return Promise.resolve(handler(req as TRequest, res, next)).catch(next);
  };
}

export default asyncHandler;
