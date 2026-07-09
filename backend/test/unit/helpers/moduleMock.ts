export function mockModule(modulePath: string, exports: NodeModule['exports']) {
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    } as NodeModule;
}

export function clearModules(...modulePaths: string[]) {
    modulePaths.flat().forEach(modulePath => {
        delete require.cache[modulePath];
    });
}
