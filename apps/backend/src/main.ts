import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { loadConfig } from './common/config';
import { getOrCreateRequestId } from './common/request-id';
import { HttpExceptionEnvelopeFilter } from './common/http-exception.filter';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, bodyLimit: 4096 }),
  );

  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: config.frontendOrigin, credentials: true });
  app.useGlobalFilters(new HttpExceptionEnvelopeFilter());

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', async (request: any, reply: any) => {
    request.requestId = getOrCreateRequestId(request.headers['x-request-id']);
    reply.header('x-request-id', request.requestId);
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== config.frontendOrigin) {
      return reply.code(403).send({ error: { code: 'ORIGIN_REJECTED', message: 'درخواست امنیتی معتبر نیست.' } });
    }
  });

  await app.listen(config.backendPort, '127.0.0.1');
  console.log(JSON.stringify({ level: 'info', event: 'backend_started', port: config.backendPort }));
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'backend_boot_failed', message: error?.message ?? String(error) }));
  process.exit(1);
});
