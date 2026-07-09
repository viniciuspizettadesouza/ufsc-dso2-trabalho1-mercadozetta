type ValidatedValue = object | string;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      validated?: {
        body?: ValidatedValue;
        params?: ValidatedValue;
        query?: ValidatedValue;
      };
      tenant?: { id: string; name: string; active: boolean };
      userId?: string;
    }
  }
}

export {};
