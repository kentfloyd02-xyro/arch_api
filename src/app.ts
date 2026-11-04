import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { corsMiddleware } from './middleware/cors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { checkDatabaseHealth } from './db/connection.js';
import { swaggerDocument } from './config/swagger.js';
import apiRouter from './routes/index.js';

export const app = express();

// Base Middlewares
app.use(corsMiddleware);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health Check Endpoint (System and Database failover status)
app.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.primary.status === 'healthy' || dbHealth.backup.status === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'archonnel-central-gateway',
    timestamp: new Date().toISOString(),
    database: dbHealth
  });
});

// Interactive Swagger UI API Documentation
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Archon Nell - API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true
    }
  })
);

// Redirect /docs to /api/docs
app.get('/docs', (req: Request, res: Response) => {
  res.redirect('/api/docs');
});

// Mount Central API Routes
app.use('/api/v1', apiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
});

// Central Error Handler
app.use(errorHandler);
