import client from 'prom-client';

const Registry = client.Registry;
const Histogram = client.Histogram;
const Counter = client.Counter;
const Gauge = client.Gauge;

// Create a new registry
const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Histogram for tracking route response times
const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // Response time buckets in seconds
});

// Counter for total HTTP requests per route per hour
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'hour'],
  registers: [register],
});

// Gauge for tracking active requests per route
const httpRequestsActive = new Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['method', 'route'],
  registers: [register],
});

// Helper function to get current hour in ISO format
const getCurrentHour = () => {
  const now = new Date();
  return now.toISOString().split(':')[0]; // Returns YYYY-MMTHH
};

export {
  register,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  httpRequestsActive,
  getCurrentHour,
};
