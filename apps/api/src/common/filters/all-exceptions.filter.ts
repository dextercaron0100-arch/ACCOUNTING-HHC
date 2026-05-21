import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? message;
        code = (resp['error'] as string) ?? code;
        details = resp['details'];
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // Prisma unique constraint violation
      if (exception.message.includes('Unique constraint')) {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_ENTRY';
      }
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      error: { code, message, details },
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
