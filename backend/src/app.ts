import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getCorsOptions } from './config/security';
import errorHandler from './middleware/errorHandler';
import requestContext from './middleware/requestContext';
import routes from './routes';
import tenantMiddleware from './middleware/tenant';

const app = express();

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(requestContext);
app.use(express.json());
app.use(tenantMiddleware);
app.use(routes);
app.use(errorHandler);

export default app;
