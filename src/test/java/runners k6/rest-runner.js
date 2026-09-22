import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { PERFORMANCE_POLICY } from './performance-policy.js';

// ============================================================
// CONFIGURACIÓN
// ============================================================

if (!__ENV.SCENARIO) {
  throw new Error('Falta la variable SCENARIO');
}

const cfg = JSON.parse(open(__ENV.SCENARIO));

const started = new Counter('flow_started');
const finished = new Counter('flow_finished');
const flowErrors = new Rate('flow_errors');
const flowMs = new Trend('flow_duration_ms', true);

const requests = new Counter('request_count');
const errors = new Rate('request_errors');
const requestMs = new Trend('request_duration_ms', true);

function invalid(message) {
  throw new Error(message);
}

function num(value, fallback, min, label, integer = false) {
  const n = Number(value ?? fallback);

  if (
    !Number.isFinite(n) ||
    n < min ||
    (integer && !Number.isInteger(n))
  ) {
    invalid('Valor inválido: ' + label);
  }

  return n;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const strategy = cfg.performance?.strategy || 'sequential';

const supportedStrategies = [
  'sequential',
  'parallel',
  'independent',
  'mixed',
];

if (!supportedStrategies.includes(strategy)) {
  invalid('strategy desconocida: ' + strategy);
}

if (cfg.protocol && cfg.protocol !== 'rest') {
  invalid('Este runner es exclusivamente REST');
}

const legacy = !!cfg.request;

if (legacy && (cfg.flows || cfg.steps)) {
  invalid('Usa request, steps o flows, sin combinarlos');
}

if (
  legacy &&
  !['sequential', 'parallel'].includes(strategy)
) {
  invalid('request único requiere sequential o parallel');
}

let flows;

if (['independent', 'mixed'].includes(strategy)) {
  if (cfg.steps) {
    invalid('independent/mixed requieren flows');
  }

  flows = clone(cfg.flows || []);
} else {
  if (cfg.flows) {
    invalid('sequential/parallel requieren steps o request');
  }

  flows = [
    {
      name: 'main',
      strategy,
      steps: legacy
        ? [{ ...cfg.request, id: 'request' }]
        : clone(cfg.steps || []),
    },
  ];
}

if (!flows.length) {
  invalid('No hay flujos');
}

// ============================================================
// VARIABLES Y DEPENDENCIAS
// ============================================================

const names = new Set();

const blocked = [
  '_proto_',
  'prototype',
  'constructor',
];

function pathValue(obj, path) {
  const parts = String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  for (const part of parts) {
    if (
      blocked.includes(part) ||
      obj == null ||
      !Object.prototype.hasOwnProperty.call(
        Object(obj),
        part
      )
    ) {
      return undefined;
    }

    obj = obj[part];
  }

  return obj;
}

function resolve(value, vars) {
  if (Array.isArray(value)) {
    return value.map(item => resolve(item, vars));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolve(item, vars),
      ])
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  function get(expression) {
    const [key, filter] = expression
      .trim()
      .split('|')
      .map(item => item.trim());

    if (filter && filter !== 'url') {
      invalid('Filtro desconocido: ' + filter);
    }

    const result = key.startsWith('env.')
      ? __ENV[key.slice(4)]
      : pathValue(vars, key);

    if (result === undefined) {
      invalid('Variable faltante: ' + key);
    }

    return filter === 'url'
      ? encodeURIComponent(String(result))
      : result;
  }

  const exact = value.match(/^\{\{([^{}]+)\}\}$/);

  if (exact) {
    return get(exact[1]);
  }

  return value.replace(
    /\{\{([^{}]+)\}\}/g,
    (_, expression) => String(get(expression))
  );
}

function validateSteps(flow) {
  const ids = new Set();

  const available = new Set([
    ...Object.keys(cfg.variables || {}),
    ...Object.keys(flow.variables || {}),
    'vu',
    'iteration',
  ]);

  const groups = flow.strategy === 'parallel'
    ? [{ parallel: flow.steps }]
    : flow.steps;

  for (const entry of groups) {
    const batch = entry.parallel || [entry];

    if (!Array.isArray(batch) || !batch.length) {
      invalid('Grupo vacío en ' + flow.name);
    }

    const newVars = [];

    for (const step of batch) {
      if (step.parallel) {
        invalid('No se permiten grupos paralelos anidados');
      }

      if (
        !step.id ||
        !/^[A-Za-z0-9_-]+$/.test(step.id) ||
        ids.has(step.id)
      ) {
        invalid(
          'id de paso inválido o repetido en ' + flow.name
        );
      }

      ids.add(step.id);

      const input = JSON.stringify({
        baseUrl:
          step.baseUrl ??
          flow.baseUrl ??
          cfg.baseUrl,

        path: step.path,

        headers: {
          ...cfg.headers,
          ...flow.headers,
          ...step.headers,
        },

        body: step.body,
      });

      for (
        const match of input.matchAll(/\{\{([^{}]+)\}\}/g)
      ) {
        const key = match[1].split('|')[0].trim();
        const root = key.split(/[.\[]/)[0];

        if (
          !key.startsWith('env.') &&
          !available.has(root)
        ) {
          invalid(
            'Dependencia no disponible antes de ' +
            step.id +
            ': ' +
            key
          );
        }
      }

      if (!(step.baseUrl || flow.baseUrl || cfg.baseUrl)) {
        invalid('Falta baseUrl en ' + step.id);
      }

      if (step.expectedStatus !== undefined) {
        const values = Array.isArray(step.expectedStatus)
          ? step.expectedStatus
          : [step.expectedStatus];

        if (
          !values.length ||
          values.some(
            status =>
              !Number.isInteger(status) ||
              status < 100 ||
              status > 599
          )
        ) {
          invalid('expectedStatus inválido');
        }
      }

      if (
        step.assertions &&
        (
          !Array.isArray(step.assertions) ||
          step.assertions.some(
            assertion =>
              !assertion.path ||
              (
                !('equals' in assertion) &&
                !('exists' in assertion)
              )
          )
        )
      ) {
        invalid(
          'assertions requieren path y equals o exists'
        );
      }

      for (
        const [variable, source] of
        Object.entries(step.extract || {})
      ) {
        if (
          !/^[A-Za-z_]\w*$/.test(variable) ||
          blocked.includes(variable) ||
          ['vu', 'iteration', 'env'].includes(variable)
        ) {
          invalid('Nombre de variable inválido');
        }

        if (newVars.includes(variable)) {
          invalid(
            'Dos pasos paralelos escriben ' + variable
          );
        }

        if (typeof source !== 'string' || !source) {
          invalid('extract requiere rutas de texto');
        }

        newVars.push(variable);
      }
    }

    newVars.forEach(variable => available.add(variable));
  }

  return groups;
}

// ============================================================
// ESCENARIOS Y CARGA
// Una iteración equivale a un flujo completo.
// ============================================================

let totalExpected = 0;

const scenarios = {};
const expectedByFlow = {};
const flowMap = {};

const weights = flows.map(
  flow => num(flow.weight, 0, 0, 'weight')
);

if (
  strategy === 'mixed' &&
  (
    weights.some(weight => weight <= 0) ||
    Math.abs(
      weights.reduce((sum, weight) => sum + weight, 0) -
      100
    ) > 1e-8
  )
) {
  invalid('Los pesos positivos deben sumar 100');
}

for (const flow of flows) {
  if (
    !/^[A-Za-z0-9_-]+$/.test(flow.name || '') ||
    blocked.includes(flow.name) ||
    names.has(flow.name)
  ) {
    invalid('Nombre de flujo inválido o repetido');
  }

  names.add(flow.name);

  flow.strategy ||= 'sequential';

  if (
    !['sequential', 'parallel'].includes(flow.strategy)
  ) {
    invalid(
      'Cada flujo debe ser sequential o parallel'
    );
  }

  if (!Array.isArray(flow.steps) || !flow.steps.length) {
    invalid('Flujo sin steps');
  }

  flow.groups = validateSteps(flow);

  if (strategy === 'mixed' && flow.injection) {
    invalid('mixed usa solo performance.injection');
  }

  const injection = {
    ...cfg.performance?.injection,
    ...(strategy === 'independent'
      ? flow.injection
      : {}),
  };

  if (injection.type && injection.type !== 'tps') {
    invalid('Esta versión acepta injection.type=tps');
  }

  let tps = num(
    injection.tps,
    1,
    0.001,
    'tps'
  );

  if (strategy === 'mixed') {
    tps *= flow.weight / 100;
  }

  // Permite tasas fraccionarias sin redondearlas silenciosamente.
  // Ejemplo: 2.5 flujos/s = 2500 flujos por cada 1000 segundos.
  // No cambia la duración configurada de la prueba.
  const rate = Math.round(tps * 1000);

  if (
    rate < 1 ||
    Math.abs(rate - tps * 1000) > 1e-6
  ) {
    invalid(
      'TPS por flujo debe ser múltiplo de 0.001'
    );
  }

  const ramp = num(
    injection.rampup,
    0,
    0,
    'rampup'
  );

  const duration = num(
    injection.duration,
    10,
    0.001,
    'duration'
  );

  const pre = num(
    injection.preAllocatedVUs,
    2,
    1,
    'preAllocatedVUs',
    true
  );

  const max = num(
    injection.maxVUs,
    Math.max(pre, 1000),
    pre,
    'maxVUs',
    true
  );

  const grace = num(
    injection.gracefulStop,
    30,
    0,
    'gracefulStop'
  );

  const expected = tps * (duration + ramp / 2);

  totalExpected += expected;
  expectedByFlow[flow.name] = expected;
  flowMap[flow.name] = flow;

  scenarios[flow.name] = {
    executor: 'ramping-arrival-rate',
    exec: 'runFlow',
    timeUnit: '1000s',

    startRate: ramp > 0 ? 0 : rate,

    preAllocatedVUs: pre,
    maxVUs: max,

    gracefulStop: grace + 's',

    tags: {
      flow: flow.name,
    },

    stages: [
      ...(
        ramp > 0
          ? [{
              target: rate,
              duration: ramp + 's',
            }]
          : []
      ),
      {
        target: rate,
        duration: duration + 's',
      },
    ],
  };
}

// ============================================================
// CRITERIOS
// ============================================================

// Los casos no pueden definir ni sobrescribir
// los criterios globales de aceptación.

function rejectLocalCriteria(object, location) {
  if (!object || typeof object !== 'object') {
    return;
  }

  if (
    Object.prototype.hasOwnProperty.call(object, 'criteria')
  ) {
    throw new Error(
      'Configuración no permitida en ' +
      location +
      '.criteria. Los criterios se administran ' +
      'centralmente en performance-policy.js.'
    );
  }

  for (const [key, value] of Object.entries(object)) {
    if (value && typeof value === 'object') {
      rejectLocalCriteria(
        value,
        location + '.' + key
      );
    }
  }
}

// Inspeccionamos la configuración de control.
// No inspeccionamos request.body: podría contener
// legítimamente un campo de negocio llamado criteria.
rejectLocalCriteria(cfg.report, 'report');
rejectLocalCriteria(cfg.performance, 'performance');

if (
  Object.prototype.hasOwnProperty.call(cfg, 'criteria')
) {
  throw new Error(
    'No se permite criteria en la raíz del caso.'
  );
}

for (const flow of cfg.flows || []) {
  if (
    Object.prototype.hasOwnProperty.call(flow, 'criteria')
  ) {
    throw new Error(
      'No se permite criteria en el flujo ' + flow.name
    );
  }

  rejectLocalCriteria(
    flow.report,
    'flows.' + flow.name + '.report'
  );

  rejectLocalCriteria(
    flow.injection,
    'flows.' + flow.name + '.injection'
  );
}

const criteria = PERFORMANCE_POLICY.criteria;

const allowedCriteria = [
  'p95Ms',
  'p99Ms',
  'maxErrorPct',
  'maxFlowErrorPct',
  'minLoadPct',
  'maxDroppedIterations',
  'minSamples',
];

for (const [key, value] of Object.entries(criteria)) {
  if (!allowedCriteria.includes(key)) {
    invalid('Criterio desconocido: ' + key);
  }

  num(
    value,
    0,
    0,
    key,
    ['minSamples', 'maxDroppedIterations'].includes(key)
  );

  if (key.endsWith('Pct') && value > 100) {
    invalid(key + ' debe ser <=100');
  }
}

const thresholds = {
  request_duration_ms: [],
  request_errors: [],
  flow_errors: [],
  request_count: [],
  flow_started: [],
};

if (criteria.p95Ms !== undefined) {
  thresholds.request_duration_ms.push(
    'p(95)<=' + criteria.p95Ms
  );
}

if (criteria.p99Ms !== undefined) {
  thresholds.request_duration_ms.push(
    'p(99)<=' + criteria.p99Ms
  );
}

if (criteria.maxErrorPct !== undefined) {
  thresholds.request_errors.push(
    'rate<=' + criteria.maxErrorPct / 100
  );
}

thresholds.flow_errors.push(
  'rate<=' + (criteria.maxFlowErrorPct ?? 0) / 100
);

if (criteria.minSamples !== undefined) {
  thresholds.request_count.push(
    'count>=' + criteria.minSamples
  );
}

if (criteria.minLoadPct !== undefined) {
  thresholds.flow_started.push(
    'count>=' +
    Math.floor(
      totalExpected * criteria.minLoadPct / 100
    )
  );
}

if (criteria.maxDroppedIterations !== undefined) {
  thresholds.dropped_iterations = [
    'count<=' + criteria.maxDroppedIterations,
  ];
}

// Submétricas por flujo para el resumen.
for (const flow of flows) {
  const metrics = [
    ['flow_started', 'count>=0'],
    ['flow_finished', 'count>=0'],
    ['flow_errors', 'rate>=0'],
    ['request_count', 'count>=0'],
    ['request_errors', 'rate>=0'],
    ['request_duration_ms', 'p(95)>=0'],
  ];

  for (const [metric, condition] of metrics) {
    thresholds[
      metric + '{flow:' + flow.name + '}'
    ] = [condition];
  }
}

export const options = {
  scenarios,
  thresholds,

  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'count',
    'p(90)',
    'p(95)',
    'p(99)',
  ],

  insecureSkipTLSVerify:
    cfg.insecureSkipTLSVerify ?? true,

  batch: num(
    cfg.batch,
    20,
    1,
    'batch',
    true
  ),

  batchPerHost: num(
    cfg.batchPerHost,
    6,
    1,
    'batchPerHost',
    true
  ),
};

// ============================================================
// CONSTRUCCIÓN DE REQUEST
// ============================================================

function prepare(step, flow, vars) {
  const base = resolve(
    step.baseUrl || flow.baseUrl || cfg.baseUrl,
    vars
  );

  const path = resolve(step.path || '', vars);

  const url =
    String(base).replace(/\/$/, '') +
    '/' +
    String(path).replace(/^\//, '');

  const headers = resolve(
    {
      Accept: 'application/json',
      ...cfg.headers,
      ...flow.headers,
      ...step.headers,
    },
    vars
  );

  let body = resolve(step.body ?? null, vars);

  if (body !== null) {
    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }

    const hasContentType = Object.keys(headers).some(
      key => key.toLowerCase() === 'content-type'
    );

    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
  }

  return {
    method: String(step.method || 'GET').toUpperCase(),
    url,
    body,

    params: {
      headers,

      timeout: step.timeout || '60s',

      tags: {
        flow: flow.name,
        step: step.id,
        name: flow.name + '/' + step.id,
      },
    },
  };
}

// ============================================================
// VALIDACIÓN Y EXTRACCIÓN DE RESPUESTAS
// ============================================================

function assess(response, step, flow, vars) {
  const tags = {
    flow: flow.name,
    step: step.id,
  };

  const statuses = step.expectedStatus ?? 200;

  let ok =
    !!response &&
    (
      Array.isArray(statuses)
        ? statuses.includes(response.status)
        : response.status === statuses
    );

  if (step.allowEmptyBody !== true) {
    ok =
      ok &&
      response?.body != null &&
      response.body.length > 0;
  }

  let json;

  const needsJson =
    (step.assertions || []).length ||
    Object.values(step.extract || {}).some(
      source => !source.startsWith('header:')
    );

  if (needsJson) {
    try {
      json = response.json();
    } catch (_) {
      ok = false;
    }
  }

  for (const assertion of step.assertions || []) {
    const actual = pathValue(json, assertion.path);

    if ('exists' in assertion) {
      ok =
        ok &&
        (
          (actual !== undefined && actual !== null) ===
          assertion.exists
        );
    }

    if ('equals' in assertion) {
      ok =
        ok &&
        JSON.stringify(actual) ===
        JSON.stringify(
          resolve(assertion.equals, vars)
        );
    }
  }

  const extracted = {};

  for (
    const [name, source] of
    Object.entries(step.extract || {})
  ) {
    let value;

    if (source.startsWith('header:')) {
      const header = source.slice(7).toLowerCase();

      const key = Object.keys(
        response?.headers || {}
      ).find(
        item => item.toLowerCase() === header
      );

      value = key === undefined
        ? undefined
        : response.headers[key];
    } else {
      value = pathValue(json, source);
    }

    if (value === undefined || value === null) {
      ok = false;
    } else {
      extracted[name] = value;
    }
  }

  requests.add(1, tags);
  errors.add(!ok, tags);

  requestMs.add(
    response?.timings?.duration || 0,
    tags
  );

  check(
    response,
    {
      [flow.name + '/' + step.id + ': validación']:
        () => !!ok,
    },
    tags
  );

  if (ok) {
    Object.assign(vars, extracted);
  }

  return !!ok;
}

// ============================================================
// EJECUCIÓN
// ============================================================

export function runFlow() {
  const flow = flowMap[exec.scenario.name];

  const tags = {
    flow: flow.name,
  };

  // Variables nuevas para cada iteración.
  const vars = {
    ...clone(cfg.variables || {}),
    ...clone(flow.variables || {}),

    vu: exec.vu.idInTest,
    iteration: exec.scenario.iterationInTest,
  };

  const start = Date.now();
  let ok = true;

  started.add(1, tags);

  try {
    for (const group of flow.groups) {
      const steps = group.parallel || [group];

      const prepared = steps.map(
        step => prepare(step, flow, vars)
      );

      let responses;

      try {
        if (group.parallel) {
          responses = http.batch(prepared);
        } else {
          const request = prepared[0];

          responses = [
            http.request(
              request.method,
              request.url,
              request.body,
              request.params
            ),
          ];
        }
      } catch (_) {
        responses = steps.map(() => null);
      }

      let groupOk = true;

      // Los pasos paralelos usan las variables previas al grupo.
      const snapshot = { ...vars };
      const pending = {};

      for (let i = 0; i < steps.length; i++) {
        const local = { ...snapshot };

        const result = assess(
          responses[i],
          steps[i],
          flow,
          local
        );

        if (result) {
          for (
            const key of
            Object.keys(steps[i].extract || {})
          ) {
            pending[key] = local[key];
          }
        }

        groupOk = result && groupOk;
      }

      Object.assign(vars, pending);

      ok = groupOk && ok;

      if (
        !groupOk &&
        flow.stopOnFailure !== false
      ) {
        break;
      }
    }
  } catch (_) {
    ok = false;

    if (__ENV.DEBUG === '1') {
      console.error(
        'Error preparando/validando flujo ' +
        flow.name +
        '; revisa variables y assertions.'
      );
    }
  } finally {
    finished.add(1, tags);
    flowErrors.add(!ok, tags);
    flowMs.add(Date.now() - start, tags);
  }
}

export default runFlow;

// ============================================================
// REPORTE HTML Y JSON
// ============================================================

function html(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value).replace(
    /[&<>"']/g,
    character => entities[character]
  );
}

export function handleSummary(data) {
  const safe = String(cfg.name || 'rest-test')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');

  function val(metric, stat) {
    return data.metrics[metric]?.values?.[stat] ?? null;
  }

  const rows = flows.map(flow => {
    const suffix = '{flow:' + flow.name + '}';

    const count =
      val('flow_started' + suffix, 'count') || 0;

    const requestErrorRate =
      val('request_errors' + suffix, 'rate');

    const flowErrorRate =
      val('flow_errors' + suffix, 'rate');

    return {
      flow: flow.name,

      expectedStarts: expectedByFlow[flow.name],

      started: count,

      completed:
        val('flow_finished' + suffix, 'count') || 0,

      loadPct:
        100 * count / expectedByFlow[flow.name],

      requests:
        val('request_count' + suffix, 'count') || 0,

      requestErrorPct:
        requestErrorRate === null
          ? null
          : requestErrorRate * 100,

      flowErrorPct:
        flowErrorRate === null
          ? null
          : flowErrorRate * 100,

      p95Ms:
        val('request_duration_ms' + suffix, 'p(95)'),
    };
  });

  const failed = Object.entries(data.metrics)
    .flatMap(([name, metric]) =>
      Object.entries(metric.thresholds || {})
        .filter(([, threshold]) => !threshold.ok)
        .map(([rule]) => name + ': ' + rule)
    );

  const report = {

    name: cfg.name,
    strategy,
    environment: cfg.report?.environment,
    policyVersion: PERFORMANCE_POLICY.version,
    criteria,
    expectedStarts: totalExpected,
    flows: rows,
    failedThresholds: failed,
  };

  function fmt(value) {
    if (value === null) {
      return 'N/D';
    }

    return typeof value === 'number'
      ? Number(value.toFixed(2))
      : value;
  }

  const columns = [
    'flow',
    'expectedStarts',
    'started',
    'completed',
    'loadPct',
    'requests',
    'requestErrorPct',
    'flowErrorPct',
    'p95Ms',
  ];

  const labels = [
    'Flujo',
    'Inicios esperados',
    'Iniciados',
    'Finalizados',
    'Carga %',
    'Solicitudes',
    'Error solicitudes %',
    'Error flujos %',
    'p95 ms',
  ];

  const tableHeader = labels
    .map(label => '<th>' + label + '</th>')
    .join('');

  const tableRows = rows
    .map(row =>
      '<tr>' +
      columns
        .map(
          key =>
            '<td>' +
            html(fmt(row[key])) +
            '</td>'
        )
        .join('') +
      '</tr>'
    )
    .join('');

  const thresholdText = failed.length
    ? html(failed.join('; '))
    : (
      'Sin umbrales fallidos registrados. ' +
      'Comprueba que haya muestras y criterios configurados.'
    );

  const page = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte REST</title>
  <style>
    body {
      font: 15px system-ui;
      background: #f4f6fa;
      color: #17233b;
      margin: 40px;
    }

    table {
      border-collapse: collapse;
      background: white;
      width: 100%;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    th {
      background: #17233b;
      color: white;
    }
  </style>
</head>
<body>
  <h1>${html(cfg.name || 'Prueba REST')}</h1>

  <p>
    Modalidad: ${html(strategy)}.
    Una iteración es un flujo completo.
    Carga % compara inicios reales con la integral
    de la tasa objetivo.
  </p>

  <table>
    <tr>${tableHeader}</tr>
    ${tableRows}
  </table>

  <h2>Umbrales</h2>
  <p>${thresholdText}</p>

  <p>
    Las solicitudes paralelas están sujetas a
    batch y batchPerHost.
    No se guardan cuerpos, tokens ni cabeceras.
  </p>
</body>
</html>
`;

  return {
    [safe + '-k6-summary.json']:
      JSON.stringify(data, null, 2),

    [safe + '-execution.json']:
      JSON.stringify(report, null, 2),

    [safe + '-k6-report.html']:
      page,

    stdout:
      '\nReporte: ' +
      safe +
      '-k6-report.html\nUmbrales fallidos: ' +
      failed.length +
      '\n',
  };
}