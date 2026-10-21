import client from 'prom-client';

export const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5],
    registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
});

export const bookingsTotal = new client.Counter({
    name: 'bookings_total',
    help: 'Booking attempts by outcome',
    labelNames: ['outcome'],
    registers: [registry],
});