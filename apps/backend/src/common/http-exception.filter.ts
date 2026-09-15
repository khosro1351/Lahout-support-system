import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { AppError } from './app-error';

@Catch()
export class HttpExceptionEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest & { requestId?: string }>();
    const reply = ctx.getResponse<FastifyReply>();
    const errorId = randomUUID();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای غیرمنتظره‌ای رخ داد.';
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR';
      message = status >= 500 ? 'خطای غیرمنتظره‌ای رخ داد.' : 'درخواست معتبر نیست.';
    } else if (exception && typeof exception === 'object' && 'statusCode' in exception && typeof exception.statusCode === 'number' && exception.statusCode >= 400 && exception.statusCode < 500) {
      status = exception.statusCode;
      code = 'INVALID_REQUEST';
      message = 'درخواست معتبر نیست.';
    } else {
      console.error(JSON.stringify({
        level: 'error',
        event: 'unhandled_exception',
        error_id: errorId,
        request_id: request.requestId,
        type: exception instanceof Error ? exception.name : 'UnknownError',
      }));
    }

    reply.status(status).send({
      error: {
        code,
        message,
        details,
        request_id: request.requestId,
        error_id: errorId,
      },
    });
  }
}
