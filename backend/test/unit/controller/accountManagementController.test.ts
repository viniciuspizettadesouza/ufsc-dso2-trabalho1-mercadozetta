import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAccountManagementController } from '@/controller/accountManagementController';

function responseDouble() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.send = vi.fn().mockReturnValue(response);
  response.clearCookie = vi.fn().mockReturnValue(response);
  return response;
}

function requestWithBody(body: object, authenticated = true) {
  return {
    validated: { body },
    tenant: { id: 'mercadozetta' },
    ...(authenticated ? { userId: 'user-1' } : {}),
  } as unknown as Request & never;
}

function services() {
  return {
    accountManagement: {
      updateProfile: vi.fn().mockResolvedValue({
        _id: 'user-1',
        tenantId: 'mercadozetta',
        email: 'seller@example.com',
        username: 'Updated Seller',
        telephone: null,
      }),
      changePassword: vi.fn().mockResolvedValue(undefined),
    },
    deactivation: {
      deactivateAccount: vi.fn().mockResolvedValue(undefined),
    },
    emailChange: {
      requestEmailChange: vi.fn().mockResolvedValue(undefined),
      confirmEmailChange: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('accountManagementController', () => {
  it('reports provider-independent email delivery unavailability', () => {
    const dependencies = services();
    const next = vi.fn() as NextFunction;
    const controller = createAccountManagementController(
      dependencies.accountManagement as never,
      dependencies.deactivation as never,
    );

    controller.requireEmailDelivery({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'ACCOUNT_DELIVERY_UNAVAILABLE',
      }),
    );
  });

  it('updates only the authenticated account profile', async () => {
    const dependencies = services();
    const controller = createAccountManagementController(
      dependencies.accountManagement as never,
      dependencies.deactivation as never,
      dependencies.emailChange as never,
    );
    const response = responseDouble();
    const body = { username: 'Updated Seller', telephone: null };

    await controller.updateProfile(requestWithBody(body), response);

    expect(dependencies.accountManagement.updateProfile).toHaveBeenCalledWith(
      body,
      'user-1',
      'mercadozetta',
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'user-1', username: 'Updated Seller' }),
    );
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('clears cookies after password change and deactivation', async () => {
    const dependencies = services();
    const controller = createAccountManagementController(
      dependencies.accountManagement as never,
      dependencies.deactivation as never,
      dependencies.emailChange as never,
    );
    const response = responseDouble();
    const passwordBody = {
      currentPassword: 'current-secret',
      password: 'replacement-secret',
      passwordConfirmation: 'replacement-secret',
    };
    const deactivationBody = {
      currentPassword: 'replacement-secret',
      confirmation: 'DEACTIVATE',
    };

    await controller.changePassword(requestWithBody(passwordBody), response);
    await controller.deactivateAccount(
      requestWithBody(deactivationBody),
      response,
    );

    expect(dependencies.accountManagement.changePassword).toHaveBeenCalledWith(
      passwordBody,
      'user-1',
      'mercadozetta',
    );
    expect(dependencies.deactivation.deactivateAccount).toHaveBeenCalledWith(
      deactivationBody,
      'user-1',
      'mercadozetta',
    );
    expect(response.clearCookie).toHaveBeenCalledTimes(6);
    expect(response.status).toHaveBeenNthCalledWith(1, 204);
    expect(response.status).toHaveBeenNthCalledWith(2, 204);
  });

  it('requests and confirms email changes through the configured sender boundary', async () => {
    const dependencies = services();
    const controller = createAccountManagementController(
      dependencies.accountManagement as never,
      dependencies.deactivation as never,
      dependencies.emailChange as never,
    );
    const response = responseDouble();
    const requestBody = {
      email: 'new@example.com',
      currentPassword: 'current-secret',
    };
    const confirmationBody = { token: 'selector.secret' };
    const next = vi.fn() as NextFunction;

    controller.requireEmailDelivery({} as Request, response, next);
    await controller.requestEmailChange(requestWithBody(requestBody), response);
    await controller.confirmEmailChange(
      requestWithBody(confirmationBody, false),
      response,
    );

    expect(next).toHaveBeenCalledWith(undefined);
    expect(dependencies.emailChange.requestEmailChange).toHaveBeenCalledWith(
      requestBody,
      'user-1',
      'mercadozetta',
    );
    expect(dependencies.emailChange.confirmEmailChange).toHaveBeenCalledWith(
      confirmationBody,
      'mercadozetta',
    );
    expect(response.send).toHaveBeenCalledWith({
      message:
        'If the address can be used, confirmation instructions will be sent.',
    });
    expect(response.clearCookie).toHaveBeenCalledTimes(3);
    expect(response.status).toHaveBeenNthCalledWith(1, 202);
    expect(response.status).toHaveBeenNthCalledWith(2, 204);
  });
});
