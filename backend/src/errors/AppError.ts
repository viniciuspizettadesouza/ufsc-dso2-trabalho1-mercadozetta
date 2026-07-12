import type { AppErrorDetails } from '@/types/errors';

class AppError extends Error {
  statusCode: number;
  code: string;
  details?: AppErrorDetails;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: AppErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export default AppError;
