import { Counter, Trend, Rate } from 'k6/metrics';
import execution from 'k6/execution';

import {
  buildModel,
  renderReport
} from './report.js';

export function createReporter(config, baseline = null) {
  const isGrpc =
    String(config.protocol || '').toLowerCase() === 'grpc';

  const injection = config.performance.injection;

  const ramp = Number(injection.rampup ?? 0);
  const duration = Number(injection.duration ?? 10);
  const target = Number(injection.tps ?? 1);
  const grace = Number(injection.gracefulStop ?? 30);

  const report = config.report || {};
  const criteria = report.criteria || {};

  // Intervalos utilizados para construir los gráficos.
  const period = Math.max(
    1,
    Math.ceil((ramp + duration + grace) / 180)
  );

  const size = Math.ceil(
    (ramp + duration + grace) / period
  ) + 1;

  // --------------------------------------------------
  // Métricas generales y por intervalo
  // --------------------------------------------------

  function makeMetrics(name) {
    return {
      started: new Counter(name + '_started'),
      done: new Counter(name + '_done'),
      errors: new Counter(name + '_errors'),
      latency: new Trend(name + '_latency', true)
    };
  }

  const all = makeMetrics('team_all');
  const stable = makeMetrics('team_stable');

  const bins = [];

  for (let i = 0; i < size; i++) {
    bins.push(makeMetrics('team_bin_' + i));
  }

  const stableErrorRate = new Rate(
    'team_stable_error_rate'
  );

  const clock = new Trend('team_clock', true);

  // --------------------------------------------------
  // Flujos y llamadas gRPC
  // Un flujo puede contener varias llamadas.
  // --------------------------------------------------

  const flowsDone = new Counter('team_flows_done');

  const stableFlowsDone = new Counter(
    'team_stable_flows_done'
  );

  const callsStarted = new Counter(
    'team_calls_started'
  );

  const stableCallsStarted = new Counter(
    'team_stable_calls_started'
  );

  // --------------------------------------------------
  // Códigos HTTP o gRPC
  // --------------------------------------------------

  const codes = {};

  const statusCodes = isGrpc
    ? Array.from({ length: 17 }, (_, i) => i)
    : [0].concat(
        Array.from({ length: 500 }, (_, i) => i + 100)
      );

  statusCodes.forEach(function (code) {
    codes[code] = new Counter('team_status_' + code);
  });

  codes.client_error = new Counter(
    'team_status_client_error'
  );

  codes.other = new Counter(
    'team_status_other'
  );

  // --------------------------------------------------
  // Tiempo transcurrido desde el inicio del escenario
  // --------------------------------------------------

  function time() {
    return Math.max(
      0,
      Date.now() - execution.scenario.startTime
    );
  }

  function isStable(t) {
    return (
      t >= ramp * 1000 &&
      t < (ramp + duration) * 1000
    );
  }

  function bin(t) {
    const index = Math.min(
      size - 1,
      Math.floor(t / 1000 / period)
    );

    return bins[index];
  }

  // --------------------------------------------------
  // Inicio de un flujo / iteración
  // Alimenta el gráfico de ramp-up.
  // --------------------------------------------------

  function start() {
    const t = time();

    clock.add(t);
    all.started.add(1);
    bin(t).started.add(1);

    if (isStable(t)) {
      stable.started.add(1);
    }

    return t;
  }

  // --------------------------------------------------
  // Inicio de una llamada gRPC dentro del flujo
  // No incrementa otra vez los inicios de flujos.
  // --------------------------------------------------

  function startCall() {
    const t = time();

    clock.add(t);
    callsStarted.add(1);

    if (isStable(t)) {
      stableCallsStarted.add(1);
    }

    return t;
  }

  // --------------------------------------------------
  // Finalización del flujo gRPC
  // Finalizado no significa necesariamente exitoso.
  // --------------------------------------------------

  function endFlow(token) {
    clock.add(time());
    flowsDone.add(1);

    if (isStable(token)) {
      stableFlowsDone.add(1);
    }
  }

  // --------------------------------------------------
  // Finalización de una llamada
  //
  // REST:
  // finish(token, response, ok)
  //
  // gRPC:
  // finish(callToken, response, ok, elapsedMs)
  // --------------------------------------------------

  function finish(token, response, ok, durationMs) {
    const t = time();
    const error = !ok;

    clock.add(t);

    // Las curvas agrupan por momento de finalización.
    const groups = [all, bin(t)];

    // La etapa estable se determina por el inicio
    // de la llamada, aunque termine durante el cierre.
    if (isStable(token)) {
      groups.push(stable);
      stableErrorRate.add(error);
    }

    const latency = isGrpc
      ? durationMs
      : response &&
        response.timings &&
        response.timings.duration;

    groups.forEach(function (group) {
      group.done.add(1);
      group.errors.add(error ? 1 : 0);

      if (
        typeof latency === 'number' &&
        Number.isFinite(latency) &&
        latency >= 0
      ) {
        group.latency.add(latency);
      }
    });

    // En gRPC, 0 significa OK.
    // Una excepción sin respuesta usa client_error.
    const status = response
      ? response.status
      : isGrpc
        ? 'client_error'
        : 0;

    (codes[status] || codes.other).add(1);
  }

  // --------------------------------------------------
  // Criterios ejecutados por k6
  // --------------------------------------------------

  const thresholds = {
    checks: ['rate==1']
  };

  const timingRules = [];

  if (criteria.p95Ms !== undefined) {
    timingRules.push(
      'p(95)<=' + criteria.p95Ms
    );
  }

  if (criteria.p99Ms !== undefined) {
    timingRules.push(
      'p(99)<=' + criteria.p99Ms
    );
  }

  if (timingRules.length) {
    thresholds.team_stable_latency = timingRules;
  }

  if (criteria.maxErrorPct !== undefined) {
    thresholds.team_stable_error_rate = [
      'rate<=' + Number(criteria.maxErrorPct) / 100
    ];
  }

  if (criteria.minLoadPct !== undefined) {
    const minimumStarts =
      target *
      duration *
      Number(criteria.minLoadPct) /
      100;

    thresholds.team_stable_started = [
      'count>=' + minimumStarts
    ];
  }

  if (criteria.maxDroppedIterations !== undefined) {
    thresholds.dropped_iterations = [
      'count<=' + criteria.maxDroppedIterations
    ];
  }

  // minSamples se evalúa en buildModel, en report.js.

  // --------------------------------------------------
  // Generación del reporte
  // --------------------------------------------------

  function summary(data) {
    const model = buildModel(
      data,
      config,
      period
    );

    const defaultName = isGrpc
      ? 'grpc-test'
      : 'rest-test';

    const safeName = String(
      config.name || defaultName
    ).replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Conserva compatibilidad con la firma anterior.
    const reference = baseline
      ? baseline.reportData || baseline
      : null;

    const html = renderReport(model, reference);

    // Los datos agregados de los gráficos quedan
    // dentro de reportData. Las métricas auxiliares
    // team_* no se duplican en el JSON.
    const cleanedMetrics = {};

    Object.keys(data.metrics || {}).forEach(
      function (name) {
        if (!name.startsWith('team_')) {
          cleanedMetrics[name] = data.metrics[name];
        }
      }
    );

    const json = Object.assign({}, data, {
      metrics: cleanedMetrics,
      reportData: model
    });

    const htmlPath =
      'k6/reports/' +
      safeName +
      '-k6-report.html';

    const jsonPath =
      'k6/reports/' +
      safeName +
      '-k6-summary.json';

    const completedLabel = isGrpc
      ? 'Llamadas gRPC finalizadas'
      : 'Solicitudes finalizadas';

    return {
      [htmlPath]: html,

      [jsonPath]: JSON.stringify(json, null, 2),

      stdout:
        '\n' +
        model.name +
        ' | ' +
        model.evaluation.status +
        '\nCarga estable: ' +
        model.stable.startsPerSec.toFixed(2) +
        ' / ' +
        target +
        ' flujos/s' +
        '\n' +
        completedLabel +
        ': ' +
        model.all.done +
        ' | Fallidas: ' +
        model.all.errors +
        '\nReporte: ' +
        htmlPath +
        '\n'
    };
  }

  return {
    start,
    startCall,
    endFlow,
    finish,
    summary,
    thresholds
  };
}