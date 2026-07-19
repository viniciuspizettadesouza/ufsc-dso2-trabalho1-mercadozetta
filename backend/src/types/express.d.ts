type ValidatedValue = object | string;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      idempotencyKey?: string;
      validated?: {
        body?: ValidatedValue;
        params?: ValidatedValue;
        query?: ValidatedValue;
      };
      tenant?: {
        id: string;
        name: string;
        active: boolean;
        currencyCode: string;
        currencyMinorUnit: number;
      };
      userId?: string;
      sessionId?: string;
    }
  }
}

export {};
