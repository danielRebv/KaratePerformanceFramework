# Política global de aceptación

## Objetivo

Centralizar los criterios de aprobación de las pruebas de performance.

Los casos JSON definen qué ejecutar y con qué carga. El archivo performance-policy.js define cómo evaluar los resultados.

## Archivo responsable

text
performance-policy.js


Debe estar en la misma carpeta que el runner.

Exporta:
- PERFORMANCE_POLICY: versión y criterios.
- getGlobalCriteria(config): valida que el caso no defina criterios locales y devuelve la política global.

Ambas exportaciones son necesarias para el runner entregado.

## Criterios

| Campo | Unidad | Significado |
|---|---|---|
| p95Ms | Milisegundos | Límite del percentil 95 de duración de solicitudes. |
| p99Ms | Milisegundos | Límite del percentil 99 de duración de solicitudes. |
| maxErrorPct | Porcentaje | Máximo de solicitudes que fallan las validaciones. |
| maxFlowErrorPct | Porcentaje | Máximo de flujos completos fallidos. |
| minLoadPct | Porcentaje | Mínimo de inicios reales respecto de los inicios programados teóricos. |
| maxDroppedIterations | Cantidad | Máximo de iteraciones que k6 no pudo iniciar. |
| minSamples | Cantidad | Mínimo de pasos HTTP contabilizados. |

Los porcentajes se escriben en escala de 0 a 100.

Ejemplos:
- 1 significa 1 %.
- 0 significa que no se admite ningún error observado.

## Perfil inicial propuesto

Para una consulta simple en un ambiente controlado:

javascript
criteria: Object.freeze({
p95Ms: 200,
p99Ms: 500,
maxErrorPct: 0,
maxFlowErrorPct: 0,
minLoadPct: 95,
maxDroppedIterations: 0,
minSamples: 1000,
}),


Estos valores son una propuesta de trabajo, no un estándar universal de mercado.

Los objetivos definitivos deben acordarse según:
- SLA/SLO del servicio.
- Criticidad.
- Dependencias.
- Carga esperada.
- Características del ambiente de prueba.

El runner aplica los valores que realmente estén guardados en performance-policy.js.

## Solicitudes y flujos fallidos

Una solicitud falla si no cumple las validaciones configuradas, por ejemplo:
- Estado HTTP esperado.
- Cuerpo no vacío, salvo excepción explícita.
- Assertions.
- Extracciones obligatorias.

Un flujo falla si alguno de sus pasos falla o si ocurre un error durante su preparación o ejecución.

En un flujo de varios pasos, el porcentaje de errores de solicitudes puede ser diferente del porcentaje de errores de flujos.

## Cálculo de carga

Para cada escenario con subida lineal desde cero:

text
Inicios esperados ≈ TPS × (duration + rampup / 2)


Para varios escenarios, se suman los inicios esperados.

text
Carga alcanzada (%) =
flujos iniciados / inicios esperados × 100


El umbral de cantidad de inicios se redondea hacia abajo.

Pueden existir pequeñas diferencias de discretización, especialmente en pruebas cortas.

minLoadPct mide inicios, no solicitudes exitosas ni cumplimiento de latencia. Se debe evaluar junto con los demás criterios.

## Mínimo de muestras

minSamples no genera solicitudes adicionales ni alarga la prueba.

Si se exige un mínimo de 1000 muestras, la carga y duración deben permitir alcanzarlo.

Ejemplo con una solicitud por flujo:
- 10 TPS.
- 5 segundos de ramp-up.
- 120 segundos de carga estable.

text
10 × (120 + 5 / 2) = 1225 llamadas aproximadas


Tener 1000 muestras no garantiza por sí solo que el p99 sea estadísticamente estable.

El mínimo actual es global: no garantiza 1000 muestras en cada flujo.

## Cambios de política

1. Modificar los criterios en performance-policy.js.
2. Actualizar version.
3. Revisar y aprobar el cambio.
4. Ejecutar las pruebas con la versión aprobada.

La versión de política queda registrada en el reporte.

## Restricción de criterios locales

No incluir report.criteria en los JSON de prueba.

El runner rechaza criterios locales en las secciones de configuración controladas.

Los cuerpos HTTP no se inspeccionan para esta restricción, porque pueden contener un campo de negocio llamado criteria.

## Protección real

Object.freeze() evita modificaciones del objeto durante la ejecución, pero no impide editar el archivo.

Para controlar las pruebas oficiales es necesario:
- Proteger el archivo de política y el runner en el repositorio.
- Exigir revisión de cambios.
- Ejecutar una versión aprobada del framework.

La separación de archivos, por sí sola, no impide cambios en una copia local.