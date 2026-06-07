import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  httpRequestsActive,
  getCurrentHour,
} from '../utils/prometheus.js';

/**
 * Route groups we want to track in Prometheus.
 * Every request under these paths will be aggregated
 * into a single route label.
 */
const normalizeRoute = (req) => {
  const path = (req.originalUrl || req.path || '')
    .split('?')[0]
    .replace(/\/+$/, '');

  if (path.startsWith('/api/v1/forms')) {
    return '/api/v1/forms';
  }

  if (path.startsWith('/api/v1/users')) {
    return '/api/v1/users';
  }

  if (path.startsWith('/api/v1/analytics')) {
    return '/api/v1/analytics';
  }

  if (path.startsWith('/api/v1/responses')) {
    return '/api/v1/responses';
  }

  return 'unknown';
};

/**
 * Prometheus metrics middleware
 * Tracks:
 * - Request duration
 * - Total requests
 * - Active requests
 * Labels:
 * - method
 * - route
 * - status_code
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const method = req.method;
  const route = normalizeRoute(req);

  // Increment active requests when request starts
  httpRequestsActive.inc({ method, route });

  const originalEnd = res.end;

  res.end = function (...args) {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const statusCode = String(res.statusCode);

    // Record request duration
    httpRequestDurationSeconds.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );

    // Increment request counter
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
      hour: getCurrentHour(),
    });

    // Decrement active requests
    httpRequestsActive.dec({ method, route });

    return originalEnd.apply(this, args);
  };

  next();
};