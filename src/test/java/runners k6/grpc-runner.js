import grpc from 'k6/net/grpc';
import { check } from 'k6';

import {
  createReporter
} from '../../../../portal/k6-reporter/collector.js';

const GRPC_STATUS_OK = Number(grpc.StatusOK);

// --------------------------------------------------
// Configuración del escenario
// --------------------------------------------------

if (!__ENV.SCENARIO) {
  throw new Error(
    'Falta indicar el escenario: -e SCENARIO=../scenarios/...json'
  );
}

const config = JSON.parse(open(__ENV.SCENARIO));

config.protocol = 'grpc';

if (!config.host) {
  throw new Error('Falta host en el escenario.');
}

if (!config.proto) {
  throw new Error('Falta proto en el escenario.');
}

if (!config.performance || !config.performance.injection) {
  throw new Error('Falta performance.injection en el escenario.');
}

const injection = config.performance.injection;

const tps = Number(injection.tps);
const rampup = Number(injection.rampup ?? 0);
const duration = Number(injection.duration);

const preAllocatedVUs = Number(
  injection.preAllocatedVUs ?? 2
);

const maxVUs = Number(injection.maxVUs ?? 10);

const gracefulStop = Number(
  injection.gracefulStop ?? 30
);

if (!Number.isInteger(tps) || tps <= 0) {
  throw new Error('tps debe ser un entero mayor que cero.');
}

if (!Number.isFinite(rampup) || rampup < 0) {
  throw new Error('rampup debe ser un número mayor o igual a cero.');
}

if (!Number.isFinite(duration) || duration <= 0) {
  throw new Error('duration debe ser un número mayor que cero.');
}

if (
  !Number.isInteger(preAllocatedVUs) ||
  preAllocatedVUs <= 0 ||
  !Number.isInteger(maxVUs) ||
  maxVUs < preAllocatedVUs
) {
  throw new Error(
    'Revisa los VUs: deben ser enteros positivos y ' +
    'maxVUs debe ser mayor o igual a preAllocatedVUs.'
  );
}

if (!Number.isFinite(gracefulStop) || gracefulStop < 0) {
  throw new Error(
    'gracefulStop debe ser un número mayor o igual a cero.'
  );
}

// --------------------------------------------------
// Cliente y archivo proto
// --------------------------------------------------

const client = new grpc.Client();

const protoParts = String(config.proto).split('/');
const protoFile = protoParts.pop();
const protoDir = protoParts.join('/') || '.';

client.load([protoDir], protoFile);

// --------------------------------------------------
// Llamada individual o flujo de varias llamadas
// --------------------------------------------------

const requestList = Array.isArray(config.request)
  ? config.request
  : [
      {
        method: config.method,
        request: config.request ?? {},
        expectedStatus: config.expectedStatus,
        extractFromPrevious: config.extractFromPrevious
      }
    ];

if (!requestList.length) {
  throw new Error('El escenario no contiene llamadas gRPC.');
}

function fullMethod(step) {
  const method = String(step.method || '').replace(/^\/+/, '');

  if (!method) {
    throw new Error('Falta method en una llamada gRPC.');
  }

  // También admite package.Service/Method directamente.
  if (method.includes('/')) {
    return method;
  }

  const service = step.service || config.service;

  if (!service) {
    throw new Error('Falta service para el método ' + method);
  }

  return String(service).replace(/\/+$/, '') + '/' + method;
}

requestList.forEach(function (step, index) {
  if (!step || typeof step !== 'object') {
    throw new Error(
      'La llamada ' + (index + 1) + ' no es un objeto válido.'
    );
  }

  fullMethod(step);

  const expectedStatus = Number(
    step.expectedStatus ?? config.expectedStatus ?? GRPC_STATUS_OK
  );

  if (
    !Number.isInteger(expectedStatus) ||
    expectedStatus < 0 ||
    expectedStatus > 16
  ) {
    throw new Error(
      'expectedStatus debe ser un código gRPC entre 0 y 16.'
    );
  }
});

// --------------------------------------------------
// Reporte compartido
// --------------------------------------------------

const reporter = createReporter(config, null);

// --------------------------------------------------
// Perfil de carga
// TPS = inicios de flujos por segundo
// --------------------------------------------------

const stages = [];

if (rampup > 0) {
  stages.push({
    target: tps,
    duration: rampup + 's'
  });
}

stages.push({
  target: tps,
  duration: duration + 's'
});

export const options = {
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
    'count'
  ],

  thresholds: reporter.thresholds,

  scenarios: {
    grpc_load: {
      executor: 'ramping-arrival-rate',
      startRate: rampup > 0 ? 0 : tps,
      timeUnit: '1s',
      preAllocatedVUs,
      maxVUs,
      stages,
      gracefulStop: gracefulStop + 's'
    }
  },

  // Conserva el comportamiento de tu runner anterior.
  // Puedes indicar false explícitamente en el escenario.
  insecureSkipTLSVerify:
    config.insecureSkipTLSVerify ?? true
};

// --------------------------------------------------
// Lectura de campos de una respuesta
// Ejemplo: organization[0].organization_id
// --------------------------------------------------

function getValueByPath(obj, path) {
  return String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .reduce(function (current, key) {
      return current == null ? undefined : current[key];
    }, obj);
}

// --------------------------------------------------
// Reemplazo de variables
// Ejemplo: "${organization_id}"
// Conserva tipos y arreglos.
// --------------------------------------------------

function replaceVariables(value, variables) {
  if (typeof value === 'string') {
    const exact = value.match(/^\$\{([^}]+)\}$/);

    if (exact) {
      const key = exact[1];

      if (
        !Object.prototype.hasOwnProperty.call(variables, key)
      ) {
        throw new Error('Variable no encontrada: ' + key);
      }

      return variables[key];
    }

    return value.replace(
      /\$\{([^}]+)\}/g,
      function (_, key) {
        if (
          !Object.prototype.hasOwnProperty.call(variables, key)
        ) {
          throw new Error('Variable no encontrada: ' + key);
        }

        return String(variables[key]);
      }
    );
  }

  if (Array.isArray(value)) {
    return value.map(function (item) {
      return replaceVariables(item, variables);
    });
  }

  if (value && typeof value === 'object') {
    const result = {};

    Object.keys(value).forEach(function (key) {
      result[key] = replaceVariables(value[key], variables);
    });

    return result;
  }

  return value;
}

// --------------------------------------------------
// Registro de errores del runner
// DEBUG=true permite ver detalles en consola.
// --------------------------------------------------

function registerRunnerError(label, error) {
  const validations = {};

  validations[label] = function (value) {
    return value === true;
  };

  check(false, validations);

  if (__ENV.DEBUG === 'true') {
    console.error(
      label + ': ' +
      String(error && error.message ? error.message : error)
    );
  }
}

// --------------------------------------------------
// Ejecución del flujo
// --------------------------------------------------

export default function () {
  const flowToken = reporter.start();

  // Variables aisladas para esta iteración.
  const variables = {};

  let connected = false;

  try {
    client.connect(config.host, {
      plaintext: config.tls === false
    });

    connected = true;

    check(true, {
      'Conexión gRPC establecida': function (value) {
        return value;
      }
    });

    for (const step of requestList) {
      const method = fullMethod(step);

      const payload = replaceVariables(
        step.request ?? {},
        variables
      );

      const params = {
        metadata: replaceVariables(
          Object.assign(
            {},
            config.metadata || {},
            step.metadata || {}
          ),
          variables
        ),

        timeout: step.timeout ?? config.timeout ?? '60s',

        tags: {
          name: method
        }
      };

      const authority = step.authority ?? config.authority;

      if (authority) {
        params.authority = authority;
      }

      const expectedStatus = Number(
        step.expectedStatus ??
        config.expectedStatus ??
        GRPC_STATUS_OK
      );

      const callToken = reporter.startCall();
      const startedAt = Date.now();

      let response = null;
      let invocationError = null;

      try {
        const rawResponse = client.invoke(
          method,
          payload,
          params
        );

        response = rawResponse == null ? rawResponse : {
          status: Number(rawResponse.status),
          message: rawResponse.message,
          error: rawResponse.error,
          headers: rawResponse.headers,
          trailers: rawResponse.trailers
        };
      } catch (error) {
        invocationError = error;
      }

      // Tiempo observado alrededor de invoke.
      // Excluye la conexión inicial.
      const elapsedMs = Date.now() - startedAt;

      if (invocationError && __ENV.DEBUG === 'true') {
        console.error(
          method + ': ' +
          String(invocationError.message || invocationError)
        );
      }

      const validations = {};

      validations[method + ' · estado esperado'] =
        function (result) {
          return (
            invocationError === null &&
            result != null &&
            result.status === expectedStatus
          );
        };

      if (expectedStatus === GRPC_STATUS_OK) {
        validations[method + ' · respuesta presente'] =
          function (result) {
            // Un mensaje {} es válido.
            return result != null && result.message != null;
          };
      }

      let ok = check(response, validations);

      try {
        if (ok && step.extractFromPrevious) {
          const extracted = {};

          for (
            const variableName of
            Object.keys(step.extractFromPrevious)
          ) {
            const path =
              step.extractFromPrevious[variableName];

            const value = getValueByPath(
              response.message,
              path
            );

            const extractionCheck = {};

            extractionCheck[
              method + ' · extracción ' + variableName
            ] = function () {
              return value !== undefined && value !== null;
            };

            const extractedOk = check(
              value,
              extractionCheck
            );

            ok = extractedOk && ok;

            if (extractedOk) {
              extracted[variableName] = value;
            }
          }

          if (ok) {
            Object.assign(variables, extracted);
          }
        }
      } catch (error) {
        ok = false;

        registerRunnerError(
          method + ' · extracción sin excepción',
          error
        );
      } finally {
        // Una medición por llamada realizada.
        reporter.finish(
          callToken,
          response,
          ok,
          elapsedMs
        );
      }

      // Detiene esta iteración si falla un paso.
      // La siguiente iteración comienza un flujo nuevo.
      if (!ok) {
        break;
      }
    }
  } catch (error) {
    registerRunnerError(
      connected
        ? 'Preparación del flujo sin excepción'
        : 'Conexión gRPC establecida',
      error
    );
  } finally {
    try {
      if (connected) {
        client.close();
      }
    } catch (error) {
      registerRunnerError(
        'Cierre de conexión sin excepción',
        error
      );
    } finally {
      // Flujo finalizado, tanto exitoso como fallido.
      reporter.endFlow(flowToken);
    }
  }
}

// --------------------------------------------------
// Generación de HTML y JSON
// --------------------------------------------------

export function handleSummary(data) {
  return reporter.summary(data);
}