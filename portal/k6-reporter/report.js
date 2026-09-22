function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// ==================================================
// Construcción de los datos del reporte
// ==================================================

export function buildModel(data, config, period) {
  const metrics = data.metrics || {};

  const values = name =>
    (metrics[name] || {}).values || {};

  const count = name =>
    values(name).count || 0;

  const isGrpc =
    String(config.protocol || '').toLowerCase() === 'grpc';

  const injection = config.performance.injection;
  const settings = config.report || {};
  const criteria = settings.criteria || {};

  const ramp = Number(injection.rampup ?? 0);
  const duration = Number(injection.duration ?? 10);
  const target = Number(injection.tps ?? 1);
  const planned = ramp + duration;

  const state = data.state || {};

  const actual = numeric(state.testRunDurationMs)
    ? state.testRunDurationMs / 1000
    : (values('team_clock').max || 0) / 1000;

  const observedStable = Math.min(
    duration,
    Math.max(0, actual - ramp)
  );

  function group(prefix) {
    const timing = values(prefix + '_latency');
    const done = count(prefix + '_done');
    const errors = count(prefix + '_errors');

    const result = {
      started: count(prefix + '_started'),
      done,
      errors,

      errorPct: done
        ? 100 * errors / done
        : null,

      latencySamples: numeric(timing.count)
        ? timing.count
        : null
    };

    ['avg', 'min', 'max'].forEach(key => {
      result[key] = numeric(timing[key])
        ? timing[key]
        : null;
    });

    [90, 95, 99].forEach(p => {
      const value = timing['p(' + p + ')'];

      result['p' + p] = numeric(value)
        ? value
        : null;
    });

    return result;
  }

  const all = group('team_all');
  const stable = group('team_stable');

  stable.startsPerSec = observedStable
    ? stable.started / observedStable
    : 0;

  stable.loadPct = target * duration
    ? 100 * stable.started / (target * duration)
    : null;

  const completedFlows = isGrpc
    ? count('team_flows_done')
    : all.done;

  const stableCompletedFlows = isGrpc
    ? count('team_stable_flows_done')
    : stable.done;

  const stableCallsStarted = isGrpc
    ? count('team_stable_calls_started')
    : stable.started;

  const callsStarted = isGrpc
    ? count('team_calls_started')
    : all.started;

  const interrupted = numeric(state.iterationsInterrupted)
    ? state.iterationsInterrupted
    : Math.max(0, all.started - completedFlows);

  // --------------------------------------------------
  // Carga planificada acumulada
  // --------------------------------------------------

  function plannedStarts(t) {
    t = Math.min(Math.max(t, 0), planned);

    if (!ramp) {
      return target * t;
    }

    return t <= ramp
      ? target * t * t / (2 * ramp)
      : target * ramp / 2 + target * (t - ramp);
  }

  // --------------------------------------------------
  // Series temporales
  // --------------------------------------------------

  const rows = [];

  for (let i = 0; i < Math.ceil(actual / period); i++) {
    const a = i * period;
    const b = Math.min(a + period, actual);
    const g = group('team_bin_' + i);

    rows.push({
      a,
      b,
      x: (a + b) / 2,

      started: g.started,
      done: g.done,
      errors: g.errors,

      avg: g.avg,
      p95: g.p95,
      p99: g.p99,

      errorPct: g.errorPct,
      samples: g.latencySamples,

      startsPerSec: g.started / (b - a),
      responsesPerSec: g.done / (b - a),

      target:
        (plannedStarts(b) - plannedStarts(a)) / (b - a)
    });
  }

  // --------------------------------------------------
  // Códigos de respuesta
  // --------------------------------------------------

  const codes = Object.keys(metrics)
    .filter(key =>
      key.startsWith('team_status_') && count(key) > 0
    )
    .map(key => ({
      code: key.slice('team_status_'.length),
      count: count(key),

      pct: all.done
        ? 100 * count(key) / all.done
        : null
    }));

  // --------------------------------------------------
  // Checks
  // --------------------------------------------------

  const checks = [];

  function walk(group, path) {
    const name = group.name
      ? path + '/' + group.name
      : path;

    Object.values(group.checks || {}).forEach(item => {
      checks.push({
        name:
          (name ? name + ' / ' : '') +
          item.name,

        passed: item.passes || 0,
        failed: item.fails || 0
      });
    });

    Object.values(group.groups || {}).forEach(child => {
      walk(child, name);
    });
  }

  walk(data.root_group || {}, '');

  // --------------------------------------------------
  // Thresholds
  // --------------------------------------------------

  const thresholds = [];

  Object.keys(metrics).forEach(name => {
    Object.keys(
      metrics[name].thresholds || {}
    ).forEach(rule => {
      thresholds.push({
        metric: name,
        rule,
        ok: metrics[name].thresholds[rule].ok
      });
    });
  });

  const dropped = count('dropped_iterations');

  // --------------------------------------------------
  // Evaluación de criterios
  // --------------------------------------------------

  const criterionRows = [];

  function criterion(key, label, value, op, unit) {
    if (criteria[key] === undefined) {
      return;
    }

    const limit = Number(criteria[key]);

    const pass = numeric(value) && numeric(limit)
      ? op === '>='
        ? value >= limit
        : value <= limit
      : null;

    criterionRows.push({
      key,
      label,
      value,
      limit,
      op,
      unit,
      pass
    });
  }

  criterion(
    'p95Ms',
    'p95 de llamadas estables',
    stable.p95,
    '<=',
    'ms'
  );

  criterion(
    'p99Ms',
    'p99 de llamadas estables',
    stable.p99,
    '<=',
    'ms'
  );

  criterion(
    'maxErrorPct',
    'Llamadas estables fallidas',
    stable.errorPct,
    '<=',
    '%'
  );

  criterion(
    'minLoadPct',
    'Inicios frente al plan estable',
    stable.loadPct,
    '>=',
    '%'
  );

  criterion(
    'maxDroppedIterations',
    'Iteraciones descartadas en toda la prueba',
    dropped,
    '<=',
    ''
  );

  const sampleLimit = Number(criteria.minSamples ?? 30);
  const reasons = [];

  if (actual + 0.1 < planned) {
    reasons.push(
      'La ejecución terminó antes de completar el tiempo planificado.'
    );
  }

  if (stable.done < stableCallsStarted) {
    reasons.push(
      'Hay llamadas estables sin finalizar.'
    );
  }

  if (stableCompletedFlows < stable.started) {
    reasons.push(
      'Hay flujos estables sin finalizar.'
    );
  }

  if (interrupted) {
    reasons.push(
      'Flujos interrumpidos: ' + interrupted + '.'
    );
  }

  if (!all.done) {
    reasons.push(
      'No se registraron llamadas finalizadas.'
    );
  }

  if (!numeric(stable.latencySamples)) {
    reasons.push(
      'No hay conteo de muestras estables. ' +
      'Revisa que summaryTrendStats incluya count.'
    );
  } else if (stable.latencySamples < sampleLimit) {
    reasons.push(
      'Muestras estables: ' +
      stable.latencySamples +
      '; mínimo configurado: ' +
      sampleLimit +
      '.'
    );
  }

  const failedChecks = checks.reduce(
    (sum, item) => sum + item.failed,
    0
  );

  const failedThresholds = thresholds.filter(
    item => item.ok === false
  ).length;

  if (failedChecks) {
    reasons.push(
      'Validaciones fallidas en toda la prueba: ' +
      failedChecks +
      '.'
    );
  }

  if (failedThresholds) {
    reasons.push(
      'Thresholds incumplidos: ' +
      failedThresholds +
      '.'
    );
  }

  let status = 'Cumple';
  let tone = 'good';

  if (
    failedChecks ||
    failedThresholds ||
    criterionRows.some(item => item.pass === false)
  ) {
    status = 'No cumple';
    tone = 'bad';
  } else if (
    reasons.length ||
    criterionRows.some(item => item.pass === null)
  ) {
    status = 'No concluyente';
    tone = 'warn';
  } else if (!criterionRows.length) {
    status = 'Sin criterios de rendimiento';
    tone = 'neutral';
  }

  if (!criterionRows.length) {
    reasons.push(
      'Configura report.criteria para evaluar límites de rendimiento.'
    );
  }

  // --------------------------------------------------
  // Información del escenario
  // --------------------------------------------------

  const request = config.request || {};

  const steps = Array.isArray(request)
    ? request
    : [
        {
          method: config.method,
          expectedStatus: config.expectedStatus
        }
      ];

  const method = isGrpc
    ? steps.map(step => {
        const operation = String(
          step.method || ''
        ).replace(/^\/+/, '');

        return operation.includes('/')
          ? operation
          : (step.service || config.service || '') +
            '/' +
            operation;
      }).join(' → ')
    : String(request.method || 'GET').toUpperCase();

  const endpoint = isGrpc
    ? String(config.host || '')
    : (
        String(config.baseUrl || '').replace(/\/$/, '') +
        '/' +
        String(request.path || '').replace(/^\//, '')
      )
        .split(/[?#]/)[0]
        .replace(/(https?:\/\/)[^/@]+@/, '$1');

  const ended = new Date();

  return {
    schema: 'k6-team-report/v2',

    name: config.name || (
      isGrpc ? 'grpc-test' : 'rest-test'
    ),

    protocol: isGrpc ? 'gRPC' : 'REST',

    method,
    endpoint,

    expectedStatus: isGrpc
      ? steps.map(step =>
          Number(
            step.expectedStatus ??
            config.expectedStatus ??
            0
          )
        ).join(' → ')
      : Number(request.expectedStatus ?? 200),

    environment: settings.environment || 'No informado',
    version: settings.version || 'No informada',
    dataset: settings.dataset || 'No informado',

    started: new Date(
      ended.getTime() - actual * 1000
    ).toISOString(),

    ended: ended.toISOString(),

    actualSeconds: actual,
    period,

    profile: {
      target,
      ramp,
      duration,

      preAllocatedVUs: Number(
        injection.preAllocatedVUs ?? 2
      ),

      maxVUs: Number(injection.maxVUs ?? 10),

      gracefulStop: Number(
        injection.gracefulStop ?? 30
      )
    },

    all,
    stable,
    rows,
    codes,
    checks,
    thresholds,
    dropped,
    interrupted,
    callsStarted,
    completedFlows,
    criteria,

    evaluation: {
      status,
      tone,
      reasons,
      criteria: criterionRows,
      sampleLimit
    },

    timings: Object.keys(metrics)
      .filter(key =>
        !key.startsWith('team_') &&
        metrics[key].type === 'trend'
      )
      .map(key => ({
        name: key,
        values: values(key),
        unit: metrics[key].contains === 'time' ? 'ms' : ''
      })),

    note:
      'La carga mide inicios de flujos/s. Los criterios de ' +
      'latencia y error usan llamadas iniciadas en la etapa ' +
      'estable, aunque terminen después. ' +
      (
        isGrpc
          ? 'Un flujo puede incluir varios RPC. Los percentiles ' +
            'agrupan sus métodos. El tiempo se mide alrededor de ' +
            'invoke, excluyendo la conexión inicial.'
          : 'La latencia usa response.timings.duration. El collector ' +
            'registra una medición por llamada del runner; los saltos ' +
            'de redirección no se cuentan por separado aquí.'
      )
  };
}

// ==================================================
// Documento HTML autónomo
// ==================================================

export function renderReport(model) {
  const json = JSON.stringify(model)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return (
    '<!doctype html>' +
    '<html lang="es">' +
    '<head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Reporte k6</title>' +
    '<style>' + STYLE + '</style>' +
    '</head>' +
    '<body>' +
    '<main id="app"></main>' +
    '<script>(' +
    renderApp.toString() +
    ')(' +
    json +
    ');</script>' +
    '</body>' +
    '</html>'
  );
}

// ==================================================
// Estilos
// ==================================================

const STYLE = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #eef1f8;
  color: #1e293b;
  font: 15px Arial, sans-serif;
}

main {
  max-width: 1320px;
  margin: auto;
  padding: 24px;
}

header {
  background: linear-gradient(110deg, #3730a3, #7e22ce);
  color: white;
  padding: 28px;
  border-radius: 16px;
}

h1 {
  font-size: 27px;
  overflow-wrap: anywhere;
}

h2 {
  font-size: 21px;
}

h3 {
  font-size: 17px;
}

p {
  line-height: 1.6;
}

small,
.muted {
  color: #64748b;
}

header p {
  color: #ede9fe;
}

.cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin: 20px 0;
}

.card,
.panel,
footer {
  background: white;
  border: 1px solid #dce2ef;
  border-radius: 12px;
  padding: 20px;
}

.value {
  font-size: 24px;
  font-weight: bold;
  margin: 12px 0;
}

.label {
  font-size: 13px;
  color: #64748b;
}

.good {
  color: #08784f;
}

.bad {
  color: #b91c1c;
}

.warn {
  color: #a16207;
}

.neutral {
  color: #475569;
}

nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 22px 0 14px;
}

button {
  font: inherit;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

button[aria-selected=true] {
  background: #5b21b6;
  color: white;
}

button:focus-visible {
  outline: 3px solid #0891b2;
}

[hidden] {
  display: none !important;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  background: #f3f1fb;
}

th,
td {
  padding: 11px;
  border-bottom: 1px solid #e5e7eb;
  overflow-wrap: anywhere;
}

.scroll {
  overflow: auto;
}

.notice {
  background: #fff8e7;
  border-left: 4px solid #d97706;
  padding: 12px;
  margin: 10px 0;
}

.chart {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  margin: 18px 0;
}

.chart svg {
  width: 100%;
  height: auto;
}

.legend {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 13px;
}

footer {
  margin-top: 22px;
}

summary {
  cursor: pointer;
  font-weight: bold;
  padding: 14px 0;
}

@media (max-width: 850px) {
  main {
    padding: 12px;
  }

  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media print {
  nav {
    display: none;
  }

  [role=tabpanel] {
    display: block !important;
    margin-top: 15px;
  }

  .chart {
    break-inside: avoid;
  }
}
`;

// ==================================================
// Renderizado en el navegador
// Esta función debe ser autónoma.
// ==================================================

function renderApp(m) {
  const app = document.getElementById('app');
  const isGrpc = m.protocol === 'gRPC';

  const valid = value =>
    typeof value === 'number' && Number.isFinite(value);

  const f = (value, unit = '', digits = 2) =>
    valid(value)
      ? value.toLocaleString('es-CL', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits
        }) + (unit ? ' ' + unit : '')
      : 'Sin datos';

  function el(tag, text, parent, cls) {
    const node = document.createElement(tag);

    if (text != null) {
      node.textContent = text;
    }

    if (cls) {
      node.className = cls;
    }

    if (parent) {
      parent.appendChild(node);
    }

    return node;
  }

  function table(parent, headers, rows) {
    const wrapper = el('div', null, parent, 'scroll');
    const t = el('table', null, wrapper);
    const head = el('tr', null, el('thead', null, t));

    headers.forEach(text => {
      el('th', text, head);
    });

    const body = el('tbody', null, t);

    rows.forEach(row => {
      const tr = el('tr', null, body);

      row.forEach(text => {
        el('td', text, tr);
      });
    });
  }

  // --------------------------------------------------
  // Encabezado
  // --------------------------------------------------

  const header = el('header', null, app);

  el('h1', 'Reporte k6 · ' + m.name, header);

  el(
    'p',
    m.protocol +
    ' · ' +
    m.environment +
    ' · versión ' +
    m.version,
    header
  );

  el('p', m.method, header);

  // --------------------------------------------------
  // Indicadores principales
  // --------------------------------------------------

  const cards = el('div', null, app, 'cards');

  [
    [
      'Evaluación',
      m.evaluation.status,
      'Criterios y validaciones',
      m.evaluation.tone
    ],
    [
      'Carga estable',
      f(m.stable.startsPerSec, 'flujos/s'),
      f(m.stable.loadPct, '%') + ' del plan',
      ''
    ],
    [
      'p95 estable',
      f(m.stable.p95, 'ms'),
      'Llamadas iniciadas en la meseta',
      ''
    ],
    [
      'Llamadas fallidas',
      m.all.errors + ' / ' + m.all.done,
      'Entre las llamadas finalizadas',
      m.all.errors ? 'bad' : 'good'
    ],
    [
      'Iteraciones descartadas',
      String(m.dropped),
      'Inicios no ejecutados por k6',
      m.dropped ? 'warn' : 'good'
    ]
  ].forEach(item => {
    const card = el('div', null, cards, 'card');

    el('div', item[0], card, 'label');
    el('div', item[1], card, 'value ' + item[3]);
    el('small', item[2], card);
  });

  // --------------------------------------------------
  // Pestañas
  // --------------------------------------------------

  const nav = el('nav', null, app);
  nav.setAttribute('role', 'tablist');

  const panels = [];
  const buttons = [];

  function tab(name) {
    const index = panels.length;
    const button = el('button', name, nav);
    const panel = el('section', null, app, 'panel');

    button.id = 'tab-' + index;
    panel.id = 'panel-' + index;

    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);

    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);

    panels.push(panel);
    buttons.push(button);

    button.onclick = () => {
      panels.forEach((p, i) => {
        p.hidden = i !== index;

        buttons[i].setAttribute(
          'aria-selected',
          String(i === index)
        );

        buttons[i].tabIndex = i === index ? 0 : -1;
      });
    };

    button.onkeydown = event => {
      if (
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft'
      ) {
        return;
      }

      event.preventDefault();

      const next = (
        index +
        (event.key === 'ArrowRight' ? 1 : -1) +
        buttons.length
      ) % buttons.length;

      buttons[next].click();
      buttons[next].focus();
    };

    return panel;
  }

  const result = tab('Cumplimiento');
  const graphs = tab('Gráficos');
  const errors = tab('Errores y validaciones');
  const detail = tab('Detalle técnico');

  // --------------------------------------------------
  // Cumplimiento
  // --------------------------------------------------

  el('h2', 'Cumplimiento de la etapa estable', result);
  el('p', m.note, result, 'muted');

  m.evaluation.reasons.forEach(reason => {
    el('div', reason, result, 'notice');
  });

  table(
    result,
    ['Criterio', 'Medido', 'Límite', 'Evaluación'],
    m.evaluation.criteria.map(item => [
      item.label,
      f(item.value, item.unit),
      item.op + ' ' + f(item.limit, item.unit),

      item.pass === null
        ? 'Sin datos'
        : item.pass
          ? 'Cumple'
          : 'No cumple'
    ])
  );

  // --------------------------------------------------
  // Motor de gráficos SVG
  // Admite eje izquierdo y derecho.
  // --------------------------------------------------

  function chart(title, leftLabel, series, settings = {}) {
    const box = el('div', null, graphs, 'chart');

    el('h3', title, box);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');

    svg.setAttribute('viewBox', '0 0 1100 350');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', title);

    box.appendChild(svg);

    function shape(tag, attrs, text) {
      const node = document.createElementNS(ns, tag);

      Object.keys(attrs).forEach(key => {
        node.setAttribute(key, attrs[key]);
      });

      if (text != null) {
        node.textContent = text;
      }

      svg.appendChild(node);

      return node;
    }

    const maxX = Math.max(
      1,
      m.actualSeconds,
      m.profile.ramp + m.profile.duration
    );

    let maxLeft = 1;
    let maxRight = 1;
    let hasData = false;

    series.forEach(s => {
      s.points.forEach(p => {
        if (!valid(p.y)) {
          return;
        }

        hasData = true;

        if (s.axis === 'right') {
          maxRight = Math.max(maxRight, p.y);
        } else {
          maxLeft = Math.max(maxLeft, p.y);
        }
      });
    });

    if (valid(settings.limit)) {
      maxLeft = Math.max(maxLeft, settings.limit);
    }

    maxLeft *= 1.15;
    maxRight *= 1.15;

    const x = value =>
      85 + 890 * value / maxX;

    const y = (value, axis) =>
      280 - 220 * value / (
        axis === 'right' ? maxRight : maxLeft
      );

    // Fondo del ramp-up.
    shape('rect', {
      x: 85,
      y: 50,
      width: 890 * m.profile.ramp / maxX,
      height: 230,
      fill: '#f3efff'
    });

    shape('text', {
      x: 85,
      y: 18,
      fill: '#475569',
      'font-size': 12
    }, leftLabel);

    if (settings.rightLabel) {
      shape('text', {
        x: 975,
        y: 18,
        'text-anchor': 'end',
        fill: '#475569',
        'font-size': 12
      }, settings.rightLabel);
    }

    if (m.profile.ramp > 0) {
      shape('text', {
        x: 90,
        y: 42,
        fill: '#7c3aed',
        'font-size': 12
      }, 'Ramp-up');
    }

    // Ejes y cuadrícula.
    for (let i = 0; i <= 5; i++) {
      const yy = y(maxLeft * i / 5);

      shape('line', {
        x1: 85,
        x2: 975,
        y1: yy,
        y2: yy,
        stroke: '#e2e8f0'
      });

      shape('text', {
        x: 76,
        y: yy + 4,
        'text-anchor': 'end',
        'font-size': 12
      }, f(maxLeft * i / 5, '', 1));

      shape('text', {
        x: x(maxX * i / 5),
        y: 305,
        'text-anchor': 'middle',
        'font-size': 12
      }, f(maxX * i / 5, '', 1));

      if (settings.rightLabel) {
        shape('text', {
          x: 985,
          y: yy + 4,
          'font-size': 12
        }, f(maxRight * i / 5, '', 1));
      }
    }

    shape('text', {
      x: 530,
      y: 337,
      'text-anchor': 'middle',
      'font-size': 13
    }, 'Tiempo desde el inicio (s)');

    // Límite de p95, cuando está configurado.
    if (valid(settings.limit)) {
      shape('line', {
        x1: 85,
        x2: 975,
        y1: y(settings.limit),
        y2: y(settings.limit),
        stroke: '#b91c1c',
        'stroke-dasharray': '7 5'
      });

      shape('text', {
        x: 970,
        y: y(settings.limit) - 7,
        'text-anchor': 'end',
        fill: '#b91c1c',
        'font-size': 12
      }, 'Límite p95: ' + settings.limit + ' ms');
    }

    // Líneas y puntos de observación.
    series.forEach(s => {
      let path = '';
      let connected = false;

      s.points.forEach(p => {
        if (!valid(p.y)) {
          connected = false;
          return;
        }

        path +=
          (connected ? ' L ' : ' M ') +
          x(p.x) +
          ' ' +
          y(p.y, s.axis);

        connected = true;
      });

      shape('path', {
        d: path,
        fill: 'none',
        stroke: s.color,
        'stroke-width': 2.5,
        'stroke-dasharray': s.dash || ''
      });

      s.points.forEach(p => {
        if (!valid(p.y)) {
          return;
        }

        const dot = shape('circle', {
          cx: x(p.x),
          cy: y(p.y, s.axis),
          r: 3,
          fill: s.color
        });

        const tip = document.createElementNS(ns, 'title');

        tip.textContent =
          s.name +
          ': ' +
          f(p.y) +
          ' · ' +
          f(p.x, 's') +
          (
            p.samples == null
              ? ''
              : ' · muestras: ' + p.samples
          );

        dot.appendChild(tip);
      });
    });

    const legend = el('div', null, box, 'legend');

    series.forEach(s => {
      const label = el(
        'span',
        '● ' + s.name,
        legend
      );

      label.style.color = s.color;
    });

    if (!hasData) {
      el(
        'p',
        'Sin muestras para este gráfico.',
        box,
        'muted'
      );
    }
  }

  // --------------------------------------------------
  // Los tres gráficos
  // --------------------------------------------------

  el('h2', 'Carga, tiempos y degradación', graphs);

  el(
    'p',
    'Intervalos de ' +
    m.period +
    ' s. Las líneas unen observaciones; los huecos indican ' +
    'ausencia de muestras. Las llamadas se agrupan por ' +
    'finalización, incluidos los intentos que terminan con error.',
    graphs,
    'muted'
  );

  const points = key =>
    m.rows.map(row => ({
      x: row.x,
      y: row[key],
      samples: row.samples
    }));

  const p = m.profile;

  const targetPoints = p.ramp > 0
    ? [
        { x: 0, y: 0 },
        { x: p.ramp, y: p.target },
        { x: p.ramp + p.duration, y: p.target }
      ]
    : [
        { x: 0, y: p.target },
        { x: p.duration, y: p.target }
      ];

  if (m.actualSeconds > p.ramp + p.duration) {
    targetPoints.push(
      { x: p.ramp + p.duration, y: 0 },
      { x: m.actualSeconds, y: 0 }
    );
  }

  chart(
    '1. Ramp-up y carga alcanzada',
    'Flujos iniciados/s',
    [
      {
        name: 'Objetivo configurado',
        color: '#7c3aed',
        dash: '7 4',
        points: targetPoints
      },
      {
        name: 'Inicios observados/s',
        color: '#0891b2',
        points: points('startsPerSec')
      }
    ]
  );

  chart(
    '2. Curvas de tiempos',
    'Duración de llamadas (ms)',
    [
      {
        name: 'Promedio',
        color: '#0891b2',
        points: points('avg')
      },
      {
        name: 'p95',
        color: '#7c3aed',
        points: points('p95')
      },
      {
        name: 'p99',
        color: '#db2777',
        points: points('p99')
      }
    ],
    {
      limit: Number.isFinite(Number(m.criteria.p95Ms))
        ? Number(m.criteria.p95Ms)
        : undefined
    }
  );

  chart(
    '3. Evolución de latencia y caudal · degradación',
    'p95 (ms) · eje izquierdo',
    [
      {
        name: 'p95 · izquierda',
        color: '#2563eb',
        points: points('p95')
      },
      {
        name: 'Llamadas finalizadas/s · derecha',
        color: '#ea580c',
        axis: 'right',
        points: points('responsesPerSec')
      },
      {
        name: 'Objetivo medio de flujos/s · derecha',
        color: '#64748b',
        axis: 'right',
        dash: '7 4',
        points: points('target')
      }
    ],
    {
      rightLabel: 'Llamadas/s y flujos/s · eje derecho'
    }
  );

  el(
    'p',
    'Una subida sostenida de latencia junto con un caudal que ' +
    'se estanca o cae puede indicar degradación. Este gráfico ' +
    'no confirma la causa ni marca automáticamente saturación. ' +
    'El cierre puede reducir el caudal porque ya no se inicia carga.',
    graphs,
    'muted'
  );

  if (isGrpc) {
    el(
      'p',
      'Con varios RPC por flujo, llamadas/s y flujos/s son ' +
      'cantidades distintas: no se espera que sus curvas ' +
      'coincidan. Los tiempos agrupan todos los métodos del flujo.',
      graphs,
      'muted'
    );
  }

  if (
    m.rows.some(row =>
      row.samples > 0 && row.samples < 20
    )
  ) {
    el(
      'p',
      'Hay intervalos con menos de 20 muestras. Sus p95 y p99 ' +
      'son descriptivos y pueden quedar cerca del máximo.',
      graphs,
      'notice'
    );
  }

  const samples = el('details', null, graphs);

  el('summary', 'Datos de los gráficos', samples);

  table(
    samples,
    [
      'Intervalo s',
      'Inicios/s',
      'Finalizaciones/s',
      'Muestras',
      'Promedio ms',
      'p95 ms',
      'p99 ms',
      'Fallidas %'
    ],
    m.rows.map(row => [
      f(row.a) + '–' + f(row.b),
      f(row.startsPerSec),
      f(row.responsesPerSec),
      f(row.samples, '', 0),
      f(row.avg),
      f(row.p95),
      f(row.p99),
      f(row.errorPct)
    ])
  );

  // --------------------------------------------------
  // Errores y validaciones
  // --------------------------------------------------

  el('h2', 'Errores y validaciones', errors);

  el(
    'p',
    'Una llamada fallida puede incumplir varias validaciones. ' +
    'Los errores de conexión o preparación aparecen en los ' +
    'checks y pueden ocurrir antes de iniciar una llamada.',
    errors
  );

  const names = [
    'OK',
    'CANCELLED',
    'UNKNOWN',
    'INVALID_ARGUMENT',
    'DEADLINE_EXCEEDED',
    'NOT_FOUND',
    'ALREADY_EXISTS',
    'PERMISSION_DENIED',
    'RESOURCE_EXHAUSTED',
    'FAILED_PRECONDITION',
    'ABORTED',
    'OUT_OF_RANGE',
    'UNIMPLEMENTED',
    'INTERNAL',
    'UNAVAILABLE',
    'DATA_LOSS',
    'UNAUTHENTICATED'
  ];

  function codeLabel(code) {
    if (code === 'client_error') {
      return 'Excepción del cliente · sin respuesta gRPC';
    }

    if (isGrpc && names[Number(code)]) {
      return code + ' · ' + names[Number(code)];
    }

    return !isGrpc && code === '0'
      ? '0 · sin respuesta HTTP'
      : code;
  }

  table(
    errors,
    [
      isGrpc ? 'Código gRPC' : 'Código HTTP',
      'Cantidad',
      'Porcentaje'
    ],
    m.codes.map(item => [
      codeLabel(item.code),
      item.count,
      f(item.pct, '%')
    ])
  );

  el('h3', 'Validaciones de toda la prueba', errors);

  table(
    errors,
    ['Check', 'Aprobadas', 'Fallidas', 'Aprobación'],
    m.checks.map(item => [
      item.name,
      item.passed,
      item.failed,

      f(
        item.passed + item.failed
          ? 100 * item.passed / (item.passed + item.failed)
          : null,
        '%'
      )
    ])
  );

  // --------------------------------------------------
  // Detalle técnico
  // --------------------------------------------------

  el('h2', 'Detalle técnico', detail);

  table(
    detail,
    [
      'Métrica',
      'Promedio',
      'Mínimo',
      'Máximo',
      'p90',
      'p95',
      'p99'
    ],
    m.timings.map(item => [
      item.name,
      f(item.values.avg, item.unit),
      f(item.values.min, item.unit),
      f(item.values.max, item.unit),
      f(item.values['p(90)'], item.unit),
      f(item.values['p(95)'], item.unit),
      f(item.values['p(99)'], item.unit)
    ])
  );

  el(
    'p',
    'Métricas nativas globales: incluyen ramp-up y cierre. ' +
    'Sus límites de medición pueden diferir de las duraciones ' +
    'observadas por el collector.',
    detail,
    'muted'
  );

  const gates = el('details', null, detail);

  el('summary', 'Thresholds evaluados por k6', gates);

  table(
    gates,
    ['Métrica', 'Regla', 'Estado'],
    m.thresholds.map(item => [
      item.metric,
      item.rule,

      item.ok === true
        ? 'Cumple'
        : item.ok === false
          ? 'No cumple'
          : 'Sin datos'
    ])
  );

  const totals = el('details', null, detail);

  el('summary', 'Conteos de flujos y llamadas', totals);

  table(
    totals,
    ['Indicador', 'Cantidad'],
    [
      [
        'Flujos iniciados',
        m.all.started
      ],
      [
        'Flujos finalizados, exitosos o fallidos',
        m.completedFlows
      ],
      [
        'Llamadas iniciadas',
        m.callsStarted
      ],
      [
        'Llamadas sin finalizar',
        Math.max(0, m.callsStarted - m.all.done)
      ],
      [
        'Flujos interrumpidos',
        m.interrupted
      ]
    ]
  );

  // --------------------------------------------------
  // Configuración al final del reporte
  // --------------------------------------------------

  const footer = el('footer', null, app);

  el('h2', 'Configuración y trazabilidad', footer);

  table(
    footer,
    ['Parámetro', 'Configuración'],
    [
      [
        'Protocolo / destino',
        m.protocol + ' / ' + m.endpoint
      ],
      [
        'Operación / secuencia',
        m.method
      ],
      [
        'Ambiente / versión / datos',
        m.environment + ' / ' + m.version + ' / ' + m.dataset
      ],
      [
        'Inicio UTC aproximado',
        m.started
      ],
      [
        'Generación del resumen UTC',
        m.ended
      ],
      [
        'Objetivo',
        f(p.target, 'flujos/s')
      ],
      [
        'Ramp-up',
        f(p.ramp, 's')
      ],
      [
        'Etapa estable',
        f(p.duration, 's')
      ],
      [
        'VUs preasignados / máximos',
        p.preAllocatedVUs + ' / ' + p.maxVUs
      ],
      [
        'Cierre permitido',
        f(p.gracefulStop, 's')
      ],
      [
        'Estado esperado por paso',
        m.expectedStatus
      ],
      [
        'Mínimo de muestras estables',
        m.evaluation.sampleLimit
      ]
    ]
  );

  // --------------------------------------------------
  // Diccionario de métricas
  // --------------------------------------------------

  const glossary = el('details', null, footer);

  el('summary', 'Diccionario de métricas', glossary);

  table(
    glossary,
    ['Concepto', 'Interpretación'],
    [
      [
        'Flujo',
        'Una iteración del runner. Puede ejecutar varias ' +
        'llamadas gRPC en secuencia.'
      ],
      [
        'TPS configurado',
        'En este runner equivale a inicios de flujos/s; ' +
        'no garantiza transacciones exitosas/s.'
      ],
      [
        'Carga alcanzada',
        'Inicios estables / segundos observados de la meseta. ' +
        'El porcentaje usa el total de inicios planificado ' +
        'para toda la meseta.'
      ],
      [
        'p95 / p99',
        'Percentiles calculados sobre muestras individuales. ' +
        'Los percentiles globales no son promedios de los ' +
        'percentiles de los intervalos.'
      ],
      [
        'Duración',
        isGrpc
          ? 'Tiempo alrededor de client.invoke. Excluye la ' +
            'conexión inicial e incluye intentos terminados con error.'
          : 'response.timings.duration: envío, espera y recepción.'
      ],
      [
        'Finalizaciones',
        'Intentos de llamada que terminaron, con éxito o error. ' +
        'Un flujo finalizado también puede haber fallado.'
      ],
      [
        'VUs',
        'Usuarios virtuales disponibles. El máximo configurado ' +
        'no es el número real de usuarios simultáneos del servicio.'
      ],
      [
        'Muestras mínimas',
        'Regla de suficiencia configurable; no garantiza ' +
        'precisión estadística.'
      ]
    ]
  );

  buttons[0].click();
}