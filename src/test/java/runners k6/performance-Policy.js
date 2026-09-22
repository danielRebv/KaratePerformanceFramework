// Política global de aceptación.
// Administrada por el equipo responsable del framework.

export const PERFORMANCE_POLICY = Object.freeze({
  version: '1.0.0',

  criteria: Object.freeze({
    p95Ms: 200,
    p99Ms: 500,
    maxErrorPct: 0,
    maxFlowErrorPct: 0,
    minLoadPct: 95,
    maxDroppedIterations: 0,
    minSamples: 1000,
  }),
});