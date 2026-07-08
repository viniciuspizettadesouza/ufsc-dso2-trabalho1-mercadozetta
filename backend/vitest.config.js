module.exports = {
    test: {
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            exclude: [
                'src/server.js',
                'coverage/**',
                'node_modules/**',
            ],
            thresholds: {
                statements: 75,
                branches: 75,
                functions: 75,
                lines: 75,
            },
        },
    },
};
