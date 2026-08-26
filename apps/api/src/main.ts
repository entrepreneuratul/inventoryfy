import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd
      ? (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
      : // In dev, the web app's port can shift (workspace port collisions etc.) —
        // reflect any localhost origin instead of hard-coding one port.
        /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
