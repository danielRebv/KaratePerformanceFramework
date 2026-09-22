import executeFlow, {
  options as grpcOptions
} from './grpc-runner.js';

// Ejecuta una sola vez el escenario completo.
export const options = {
  scenarios: {
    grpc_functional: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,

      // Es un límite de ejecución, no una duración objetivo.
      maxDuration: '2m',
      gracefulStop: '10s'
    }
  },

  thresholds: {
    // Todas las validaciones deben aprobar.
    checks: ['rate==1'],

    // El flujo debe finalizar.
    iterations: ['count==1']
  },

  insecureSkipTLSVerify:
    grpcOptions.insecureSkipTLSVerify,

  summaryTrendStats: [
    'avg',
    'min',
    'max'
  ]
};

export default function () {
  executeFlow();
}


