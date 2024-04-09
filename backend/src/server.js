const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');
const server = express();
require('dotenv').config();

const mongoPassword = process.env.MONGODB_PASSWORD;

mongoose.connect(`mongodb+srv://viniciuspzt:${mongoPassword}@clusterzetta.gmwttyd.mongodb.net/mercadozetta?retryWrites=true&w=majority&appName=ClusterZetta`, {
    useUnifiedTopology: true, useNewUrlParser: true
}).then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

server.use(cors());
server.use(express.json());
server.use(routes);

server.listen(3333);
