const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { clearModules, mockModule } = require('../helpers/moduleMock');

const servicePath = require.resolve('../../../src/services/authService');
const securityPath = require.resolve('../../../src/config/security');
const userModelPath = require.resolve('../../../src/model/user');

function loadAuthService(userModel, secret = 'unit-test-secret') {
    clearModules(servicePath, securityPath, userModelPath);
    mockModule(userModelPath, userModel);
    mockModule(securityPath, {
        getJwtSecret: () => secret,
    });
    return require('../../../src/services/authService');
}

afterEach(() => {
    clearModules(servicePath, securityPath, userModelPath);
    vi.restoreAllMocks();
});

describe('authService', () => {
    it('normalizes email, verifies password, signs tenant-aware tokens, and strips passwords', async () => {
        const user = {
            _id: 'user-1',
            email: 'seller@example.com',
            password: await bcrypt.hash('secret123', 4),
            username: 'Seller',
            telephone: '123',
            tenantId: 'mercadozetta',
            toObject() {
                return {
                    _id: this._id,
                    email: this.email,
                    password: this.password,
                    username: this.username,
                    telephone: this.telephone,
                    tenantId: this.tenantId,
                };
            },
        };
        const select = vi.fn().mockResolvedValue(user);
        const findOne = vi.fn(() => ({ select }));
        const signSpy = vi.spyOn(jwt, 'sign');
        const { authenticate } = loadAuthService({ findOne });

        const result = await authenticate({
            email: ' Seller@Example.com ',
            password: 'secret123',
        }, 'campus-market');

        expect(findOne).toHaveBeenCalledWith({
            tenantId: 'campus-market',
            email: 'seller@example.com',
        });
        expect(select).toHaveBeenCalledWith('+password email username telephone tenantId');
        expect(signSpy).toHaveBeenCalledWith(
            { id: 'user-1', tenantId: 'campus-market' },
            'unit-test-secret',
            { expiresIn: '1d' }
        );
        expect(result.user.password).toBeUndefined();
        expect(result.token).toEqual(expect.any(String));
    });

    it('rejects missing users and invalid passwords with the same public error', async () => {
        let { authenticate } = loadAuthService({
            findOne: vi.fn(() => ({ select: vi.fn().mockResolvedValue(null) })),
        });

        await expect(authenticate({
            email: 'missing@example.com',
            password: 'secret123',
        })).rejects.toMatchObject({
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
        });

        const hashedPassword = await bcrypt.hash('secret123', 4);
        ({ authenticate } = loadAuthService({
            findOne: vi.fn(() => ({
                select: vi.fn().mockResolvedValue({
                    _id: 'user-1',
                    email: 'seller@example.com',
                    password: hashedPassword,
                }),
            })),
        }));

        await expect(authenticate({
            email: 'seller@example.com',
            password: 'wrong-password',
        })).rejects.toMatchObject({
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
        });
    });
});

export {};
