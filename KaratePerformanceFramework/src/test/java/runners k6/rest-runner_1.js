import http from 'k6/http';
import { check } from 'k6';
import { htmlReport } from '../k6-reporter/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'

const configFile =__ENV.SCENARIO;
console.log(`SCENARIO : ${configFile}`);
const config =JSON.parse(open(configFile));
const reportName = config.name || 'rest-test';

const injection = config.performance.injection;
const tps = Number(injection.tps|| 1);
const rampup = Number (injection.rampup || 0);
const duration = Number (injection.duration || 10);

const preAllocatedVUs = Number(injection.preAllocatedVUs || 2);
const maxVus = Number(injection.maxVus || 10);

console.log(`Name : ${reportName}`);
console.log(`Url : ${config.baseUrl}`);
console.log(`TPS : ${tps}`);
console.log(`RAMPUP : ${rampup}`);
console.log(`DURATION : ${duration}`);
console.log(`PRE ALLOCATED VUS : ${preAllocatedVUs}`);
console.log(`MAX VUS : ${maxVus}`);

export const options = {
  summaryTrendStats: [
     'avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'
     ],

    scenarios:{
       rest_load: {
          executor: 'ramping-arrival-rate',

          timeUnit: '1s',
          preAllocatedVUs: Number(injection.preAllocatedVUs || 2),
          maxVus: Number(injection.maxVus || 10),
          stages:[
              {
                target: tps,
                duration: `${rampup}s`
              },
              {
                   target: tps,
                   duration: `${duration}s`
              }
          ]
       }

    },
     insecureSkipTLSVerify: true
};

export default function (){
     const requestConfig = config.request;
     const method = (requestConfig.method || 'GET').toUpperCase();
     const url =
         `${config.baseUrl.replace(/\/$/, '')}/${requestConfig.path.replace(/^\//, '')}`;
     const headers =
         requestConfig.headers || {
            'Accept' : 'application/json'
         };
     const params = {
         headers: headers
     };
     let body = null;
     if (
          requestConfig.body !== null &&
          requestConfig.body !== undefined
     ){
          body = JSON.stringify(
              requestConfig.body
          );
     }
   console.log(`METHOD: ${method}`) ;
   console.log(`URL: ${url}`);

   if (body !== null){
       console.log(`REQUEST: ${body}`);
   }
   const response = http.request(
      method,
      url,
      body,
      params
   );
   console.log(`STATUS: ${response.status}`);
   console.log(`ERROR: ${response.error}`);
   console.log(`ERROR CODE: ${response.error_code}`);

   const expectedStatus =
      Number(requestConfig.expectedStatus ||200);

   let responseJson = null;

   try {
       responseJson = response.json();
   } catch (e) {
       console.log(`ERROR parsing json: ${e.message}`);
   }

   check(response, {
   'status esperado': (r) => r.status === expectedStatus,
   'response exist': (r) => r.body !== null,
   'response is not empty': (r) =>
       r.body !== undefined &&
       r.body.length > 0,
   });
 }

export function handleSummary(data) {
  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const format = (value, unit = '') => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toFixed(2) + unit;
    }

    return 'Sin datos';
  };

  const metrics = data.metrics || {};
  const timings = metrics.http_req_duration?.values || {};
  const requests = metrics.http_reqs?.values || {};
  const iterations = metrics.iterations?.values || {};

  const rows = [
    ['TPS objetivo configurado', tps],
    ['Ramp-up configurado', rampup + ' s'],
    ['Duración de la etapa estable', duration + ' s'],
    ['VUs preasignados', preAllocatedVUs],
    ['Máximo de VUs permitido', maxVus],
  ];

  const extra = `
    <section style="
      margin:24px auto;
      padding:24px;
      max-width:1100px;
      border:1px solid #cbd5e1;
      border-radius:12px;
      background:#fff;
      color:#172033;
      font-family:Arial,sans-serif;
    ">
      <h2>Configuración de la prueba</h2>

      <table style="width:100%;border-collapse:collapse">
        <tbody>
          ${rows.map(([label, value]) => `
            <tr>
              <th style="
                padding:10px;text-align:left;
                border-bottom:1px solid #e2e8f0;
              ">${label}</th>
              <td style="
                padding:10px;
                border-bottom:1px solid #e2e8f0;
              ">${value}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Diccionario de métricas</h2>
      <ul>
        <li><b>TPS:</b> transacciones por segundo.
          En este runner, el objetivo configura el inicio
          de iteraciones por segundo.</li>
        <li><b>Solicitudes/s:</b> llamadas HTTP registradas
          por segundo; no necesariamente equivalen a
          transacciones exitosas.</li>
        <li><b>VUs:</b> usuarios virtuales que ejecutan
          las iteraciones.</li>
        <li><b>Ramp-up:</b> etapa de aumento gradual
          de la tasa de inicio de iteraciones.</li>
        <li><b>p95:</b> aproximadamente el 95 % de
          las duraciones medidas está en ese valor
          o por debajo.</li>
        <li><b>Checks:</b> validaciones de las respuestas.
          Una solicitud puede tener varios checks.</li>
      </ul>
    </section>
  `;

  const originalHtml = htmlReport(data, {
    title: 'Reporte k6 -' + reportName,
  });

  const finalHtml = originalHtml.replace(
    /<\/body>/i,
    () => extra + '</body>'
  );

  return {
      stdout: textSummary(data, {
        indent: ' ',
        enableColors: true,
      }),

      ['k6/reports/' + reportName + '-k6-report.html']:
        finalHtml,

      ['k6/reports/' + reportName + '-k6-summary.json']:
        JSON.stringify(data, null, 2),
    };
  }
