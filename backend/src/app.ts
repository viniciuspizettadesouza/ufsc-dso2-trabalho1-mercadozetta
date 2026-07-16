import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { getCorsOptions } from '@/config/security';
import errorHandler from '@/middleware/errorHandler';
import requestContext from '@/middleware/requestContext';
import routes from '@/routes';
import tenantMiddleware from '@/middleware/tenant';
import { getTrustProxyHops } from '@/config/runtime';

const app = express();

app.set('trust proxy', getTrustProxyHops());
app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(requestContext);
app.use(cookieParser());
app.use(express.json());
app.use(tenantMiddleware);
app.use(routes);
app.use(errorHandler);

export default app;
