function mockModule(modulePath: string, exports: unknown) {
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    } as NodeModule;
}

function clearModules(...modulePaths: string[]) {
    modulePaths.flat().forEach(modulePath => {
        delete require.cache[modulePath];
    });
}

module.exports = {
    clearModules,
    mockModule,
};

export {};
