declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      validated?: Record<string, any>;
      tenant?: { id: string; name: string; active: boolean };
      userId?: string;
    }
  }
}

export {};
