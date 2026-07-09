declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      validated?: {
        body?: Record<string, unknown>;
        params?: Record<string, string>;
        query?: Record<string, unknown>;
      };
      tenant?: { id: string; name: string; active: boolean };
      userId?: string;
    }
  }
}

export {};
