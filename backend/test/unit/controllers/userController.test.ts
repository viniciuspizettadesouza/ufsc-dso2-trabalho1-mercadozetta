const { clearModules, mockModule } = require('../helpers/moduleMock');

const controllerPath = require.resolve('../../../src/controller/userController');
const servicePath = require.resolve('../../../src/services/userService');

function createResponse() {
    return {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
    };
}

function loadController(service: any = {}) {
    clearModules(controllerPath, servicePath);
    mockModule(servicePath, {
        createUser: service.createUser || vi.fn(),
        getPublicSellerProfile: service.getPublicSellerProfile || vi.fn(),
    });
    return require('../../../src/controller/userController');
}

afterEach(() => {
    clearModules(controllerPath, servicePath);
});

export {};

describe('userController', () => {
    it('creates a user with validated body and tenant id', async () => {
        const newUser = { _id: 'user-1', email: 'buyer@example.com' };
        const createUser = vi.fn().mockResolvedValue(newUser);
        const controller = loadController({ createUser });
        const req = {
            validated: { body: { email: 'buyer@example.com' } },
            tenant: { id: 'campus-market' },
        };
        const res = createResponse();

        await controller.add(req, res);

        expect(createUser).toHaveBeenCalledWith(req.validated.body, 'campus-market');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.send).toHaveBeenCalledWith({ newUser });
    });

    it('returns a seller profile by route param and tenant id', async () => {
        const seller = { _id: 'user-1', username: 'Seller' };
        const getPublicSellerProfile = vi.fn().mockResolvedValue(seller);
        const controller = loadController({ getPublicSellerProfile });
        const req = {
            params: { userId: 'user-1' },
            tenant: { id: 'mercadozetta' },
        };
        const res = createResponse();

        await controller.sellerProfile(req, res);

        expect(getPublicSellerProfile).toHaveBeenCalledWith('user-1', 'mercadozetta');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(seller);
    });
});
