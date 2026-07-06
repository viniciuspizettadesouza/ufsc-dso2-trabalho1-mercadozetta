const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');
const server = express();
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;
const port = process.env.PORT || 3333;

if (!mongoUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
}

mongoose.connect(mongoUri, {
    useUnifiedTopology: true, useNewUrlParser: true
}).then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

server.use(cors());
server.use(express.json());
server.use(routes);

server.listen(port, () => console.log(`Server running on port ${port}`));
