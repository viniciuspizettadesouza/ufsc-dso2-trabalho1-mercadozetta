function mockModule(modulePath, exports) {
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    };
}

function clearModules(...modulePaths) {
    modulePaths.flat().forEach(modulePath => {
        delete require.cache[modulePath];
    });
}

module.exports = {
    clearModules,
    mockModule,
};
