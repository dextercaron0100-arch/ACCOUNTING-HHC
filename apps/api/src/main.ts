import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:5173');

  app.use(helmet());
  // cookie-parser skipped — using Authorization header for tokens in dev
  // app.use(require('cookie-parser')());

  app.enableCors({
    origin: webUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new AuditLogInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Accounting System API')
    .setDescription('Full-stack accounting & financial management system API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & authorization')
    .addTag('accounts', 'Chart of accounts')
    .addTag('journal', 'Journal entries')
    .addTag('ledger', 'General ledger')
    .addTag('ar', 'Accounts receivable')
    .addTag('ap', 'Accounts payable')
    .addTag('statements', 'Financial statements')
    .addTag('procurement', 'Purchase orders & GRN')
    .addTag('inventory', 'Inventory management')
    .addTag('assets', 'Fixed assets')
    .addTag('payroll', 'Payroll processing')
    .addTag('expenses', 'Expense management')
    .addTag('banking', 'Bank reconciliation')
    .addTag('reporting', 'Reports & analytics')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  console.warn(`API running on http://localhost:${port}/api/v1`);
  console.warn(`Swagger docs at http://localhost:${port}/api/docs`);
  console.warn(`GraphQL playground at http://localhost:${port}/graphql`);
}

bootstrap();
