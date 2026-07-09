const { clearModules, mockModule } = require('../helpers/moduleMock');

const servicePath = require.resolve('../../../src/services/userService');
const userModelPath = require.resolve('../../../src/model/user');

function loadUserService(userModel) {
    clearModules(servicePath, userModelPath);
    mockModule(userModelPath, userModel);
    return require('../../../src/services/userService');
}

afterEach(() => {
    clearModules(servicePath, userModelPath);
});

describe('userService', () => {
    it('creates normalized users for a tenant and strips the password', async () => {
        const findOne = vi.fn().mockResolvedValue(null);
        const create = vi.fn().mockImplementation(async user => ({ _id: 'user-1', ...user }));
        const { createUser } = loadUserService({ findOne, create });

        const user = await createUser({
            email: ' Buyer@Example.com ',
            password: 'secret123',
            username: ' Buyer ',
            telephone: ' 999 ',
        }, 'campus-market');

        expect(findOne).toHaveBeenCalledWith({
            tenantId: 'campus-market',
            email: 'buyer@example.com',
        });
        expect(create).toHaveBeenCalledWith({
            tenantId: 'campus-market',
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        });
        expect(user).toEqual(expect.objectContaining({
            _id: 'user-1',
            email: 'buyer@example.com',
            tenantId: 'campus-market',
        }));
        expect(user.password).toBeUndefined();
    });

    it('maps duplicate lookup hits and duplicate index errors to USER_EXISTS', async () => {
        let { createUser } = loadUserService({
            findOne: vi.fn().mockResolvedValue({ _id: 'existing' }),
            create: vi.fn(),
        });

        await expect(createUser({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).rejects.toMatchObject({
            statusCode: 400,
            code: 'USER_EXISTS',
        });

        ({ createUser } = loadUserService({
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue({ code: 11000, keyPattern: { email: 1 } }),
        }));

        await expect(createUser({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).rejects.toMatchObject({
            statusCode: 400,
            code: 'USER_EXISTS',
        });
    });

    it('rethrows non-duplicate create errors', async () => {
        const error = new Error('database down');
        const { createUser } = loadUserService({
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue(error),
        });

        await expect(createUser({
            email: 'buyer@example.com',
            password: 'secret123',
            username: 'Buyer',
            telephone: '999',
        })).rejects.toBe(error);
    });

    it('returns public seller profiles', async () => {
        const findOne = vi.fn().mockResolvedValue({
            _id: 'user-1',
            username: 'Seller',
            telephone: '123',
            email: 'seller@example.com',
        });
        const { getPublicSellerProfile } = loadUserService({ findOne });

        await expect(getPublicSellerProfile('user-1', 'mercadozetta')).resolves.toEqual({
            _id: 'user-1',
            username: 'Seller',
            telephone: '123',
            email: 'seller@example.com',
            storeName: 'Seller store',
        });
        expect(findOne).toHaveBeenCalledWith({ _id: 'user-1', tenantId: 'mercadozetta' });
    });

    it('reports missing sellers', async () => {
        const { getPublicSellerProfile } = loadUserService({
            findOne: vi.fn().mockResolvedValue(null),
        });

        await expect(getPublicSellerProfile('missing', 'mercadozetta')).rejects.toMatchObject({
            statusCode: 404,
            code: 'SELLER_NOT_FOUND',
        });
    });
});
