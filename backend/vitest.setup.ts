require('ts-node/register/transpile-only');
// Make CommonJS `require()` return the default export for ESM-style TS modules
// This keeps legacy CommonJS tests working without changing all test files.
{
	const Module = require('module');
	const path = require('path');
	const originalLoad = Module._load;

	Module._load = function(request, parent, isMain) {
		const exported = originalLoad.apply(this, arguments);

		try {
			// Resolve filename for the requested module. If it's inside our src folder
			// prefer returning the default export to maintain backwards compatibility
			// with CommonJS tests that require('../src/...').
			const filename = Module._resolveFilename(request, parent);
			const backendSrc = path.join(__dirname, 'src') + path.sep;
			if (typeof filename === 'string' && filename.startsWith(backendSrc)) {
				return (exported && exported.__esModule && exported.default) ? exported.default : exported;
			}
		} catch (e) {
			// ignore resolution errors and return original export
		}

		return exported;
	};
}
