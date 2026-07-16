import express from 'express';
import type { ErrorRequestHandler, Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { getCorsOptions } from '@/config/security';
import errorHandler from '@/middleware/errorHandler';
import requestContext from '@/middleware/requestContext';
import tenantMiddleware from '@/middleware/tenant';
import { getTrustProxyHops } from '@/config/runtime';

export function createApp(
  applicationRoutes: Router,
  applicationErrorHandler: ErrorRequestHandler = errorHandler,
) {
  const app = express();

  app.set('trust proxy', getTrustProxyHops());
  app.use(helmet());
  app.use(cors(getCorsOptions()));
  app.use(requestContext);
  app.use(cookieParser());
  app.use(express.json());
  app.use(tenantMiddleware);
  app.use(applicationRoutes);
  app.use(applicationErrorHandler);

  return app;
}
