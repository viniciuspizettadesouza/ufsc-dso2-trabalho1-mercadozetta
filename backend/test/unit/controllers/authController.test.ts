import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearModules, mockModule } from '../helpers/moduleMock';

const controllerPath =
  require.resolve('../../../src/controller/authController');
const servicePath = require.resolve('../../../src/services/authService');

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function loadController(authenticate = vi.fn(), logout = vi.fn()) {
  clearModules(controllerPath, servicePath);
  mockModule(servicePath, { authenticate, logout });
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
      validated: {
        body: { email: 'seller@example.com', password: 'secret123' },
      },
      tenant: { id: 'mercadozetta' },
    };
    const res = createResponse();

    await controller.authenticate(req, res);

    expect(authenticate).toHaveBeenCalledWith(
      req.validated.body,
      'mercadozetta',
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(result);
  });

  it('revokes the authenticated session and returns no content', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const controller = loadController(vi.fn(), logout);
    const req = { userId: 'user-1', tenant: { id: 'mercadozetta' } };
    const res = createResponse();

    await controller.logout(req, res);

    expect(logout).toHaveBeenCalledWith('user-1', 'mercadozetta');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });
});
