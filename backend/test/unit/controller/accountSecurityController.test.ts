import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAccountSecurityController } from '@/controller/accountSecurityController';
import type { AccountSecurityService } from '@/services/accountSecurityService';

function responseDouble() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.send = vi.fn().mockReturnValue(response);
  response.clearCookie = vi.fn().mockReturnValue(response);
  return response;
}

function requestWithBody(body: object) {
  return {
    validated: { body },
    tenant: { id: 'mercadozetta' },
  } as unknown as Request & never;
}

function serviceDouble() {
  return {
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
    confirmEmailVerification: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountSecurityService;
}

describe('accountSecurityController', () => {
  it('reports provider-independent delivery unavailability', () => {
    const next = vi.fn() as NextFunction;

    createAccountSecurityController().requireDelivery(
      {} as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'ACCOUNT_DELIVERY_UNAVAILABLE',
      }),
    );
  });

  it('applies a common response floor to accepted requests', async () => {
    const service = serviceDouble();
    const waits: number[] = [];
    let currentTime = 100;
    const controller = createAccountSecurityController(service, {
      responseFloorMs: () => 500,
      nowMs: () => currentTime,
      wait: async (duration) => {
        waits.push(duration);
      },
    });
    const response = responseDouble();
    const emailBody = { email: 'seller@example.com' };

    currentTime = 100;
    const verification = controller.requestEmailVerification(
      requestWithBody(emailBody),
      response,
    );
    currentTime = 175;
    await verification;

    currentTime = 200;
    const reset = controller.requestPasswordReset(
      requestWithBody(emailBody),
      response,
    );
    currentTime = 800;
    await reset;

    expect(service.requestEmailVerification).toHaveBeenCalledWith(
      emailBody,
      'mercadozetta',
    );
    expect(service.requestPasswordReset).toHaveBeenCalledWith(
      emailBody,
      'mercadozetta',
    );
    expect(waits).toEqual([425, 0]);
    expect(response.status).toHaveBeenNthCalledWith(1, 202);
    expect(response.status).toHaveBeenNthCalledWith(2, 202);
    expect(response.send).toHaveBeenCalledWith({
      message: 'If an eligible account exists, instructions will be sent.',
    });
  });

  it('confirms tokens and clears cookies after a password reset', async () => {
    const service = serviceDouble();
    const controller = createAccountSecurityController(service);
    const response = responseDouble();
    const verificationBody = { token: 'selector.secret' };
    const resetBody = {
      token: 'selector.secret',
      password: 'replacement123',
      passwordConfirmation: 'replacement123',
    };

    await controller.confirmEmailVerification(
      requestWithBody(verificationBody),
      response,
    );
    await controller.confirmPasswordReset(requestWithBody(resetBody), response);

    expect(service.confirmEmailVerification).toHaveBeenCalledWith(
      verificationBody,
      'mercadozetta',
    );
    expect(service.confirmPasswordReset).toHaveBeenCalledWith(
      resetBody,
      'mercadozetta',
    );
    expect(response.clearCookie).toHaveBeenCalledTimes(3);
    expect(response.status).toHaveBeenNthCalledWith(1, 204);
    expect(response.status).toHaveBeenNthCalledWith(2, 204);
  });
});
