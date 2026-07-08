const mongoose = require('mongoose');
const app = require('./app');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;
const port = process.env.PORT || 3333;

if (!mongoUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
}

let server;

async function shutdown(signal) {
    console.log(`${signal} received, shutting down gracefully`);

    if (server)
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err)
                    return reject(err);

                console.log('HTTP server closed');
                return resolve();
            });
        });

    await mongoose.connection.close();
    process.exit(0);
}

mongoose.connect(mongoUri)
    .then(() => {
        console.log('MongoDB connected');
        server = app.listen(port, () => console.log(`Server running on port ${port}`));
    })
    .catch((err) => {
        console.error('MongoDB connection failed', err);
        process.exit(1);
    });

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
