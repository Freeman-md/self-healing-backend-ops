import client from "prom-client";

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "managed_system_",
});

export const httpRequestsTotal = new client.Counter({
  name: "managed_system_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: "managed_system_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const workOrdersCreatedTotal = new client.Counter({
  name: "managed_system_work_orders_created_total",
  help: "Total number of work orders created",
});

export const workOrderUpdatesCreatedTotal = new client.Counter({
  name: "managed_system_work_order_updates_created_total",
  help: "Total number of work order updates created",
});

metricsRegistry.registerMetric(httpRequestsTotal);
metricsRegistry.registerMetric(httpRequestDurationSeconds);
metricsRegistry.registerMetric(workOrdersCreatedTotal);
metricsRegistry.registerMetric(workOrderUpdatesCreatedTotal);