import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Gauge, register, collectDefaultMetrics } from 'prom-client';

// Enable default metrics collection (CPU, Memory, Event Loop Lag, GC, etc.)
collectDefaultMetrics();

// Define custom metrics
export const requestCounter = new Counter({
  name: 'request_count',
  help: 'Total number of HTTP requests processed by the API Gateway',
  labelNames: ['route', 'method', 'status'],
});

export const requestDuration = new Histogram({
  name: 'request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['route', 'method', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active TCP connections to the API Gateway',
});

// Middleware to track request counts and durations
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    // req.route?.path contains the matched Express route pattern (e.g. /api/leads/:id)
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const status = res.statusCode.toString();

    requestCounter.labels(route, method, status).inc();
    requestDuration.labels(route, method, status).observe(duration);
  });

  next();
};

export { register };
export default metricsMiddleware;
