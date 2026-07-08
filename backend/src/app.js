const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { getCorsOptions } = require('./config/security');
const errorHandler = require('./middleware/errorHandler');
const requestContext = require('./middleware/requestContext');
const routes = require('./routes');
const tenantMiddleware = require('./middleware/tenant');

const app = express();

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(requestContext);
app.use(express.json());
app.use(tenantMiddleware);
app.use(routes);
app.use(errorHandler);

module.exports = app;
