import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const controllerPath = require.resolve('../../../src/controller/authController');
const servicePath = require.resolve('../../../src/services/authService');

function createResponse() {
    return {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
    };
}

function loadController(authenticate = vi.fn()) {
    clearModules(controllerPath, servicePath);
    mockModule(servicePath, { authenticate });
    return require('../../../src/controller/authController');
}

afterEach(() => {
    clearModules(controllerPath, servicePath);
});

describe('authController', () => {
    it('authenticates with validated body and tenant id', async () => {
        const result = { user: { email: 'seller@example.com' }, token: 'token' };
        const authenticate = vi.fn().mockResolvedValue(result);
        const controller = loadController(authenticate);
        const req = {
            validated: { body: { email: 'seller@example.com', password: 'secret123' } },
            tenant: { id: 'mercadozetta' },
        };
        const res = createResponse();

        await controller.authenticate(req, res);

        expect(authenticate).toHaveBeenCalledWith(req.validated.body, 'mercadozetta');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(result);
    });
});
