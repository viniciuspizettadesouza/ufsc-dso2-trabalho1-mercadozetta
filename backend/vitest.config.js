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
                statements: 85,
                branches: 85,
                functions: 85,
                lines: 85,
            },
        },
    },
};
