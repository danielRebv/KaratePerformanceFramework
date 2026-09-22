# Configuración JSON de casos REST

## Objetivo

Definir servicios, solicitudes, flujos y carga.

## Ejemplo de una solicitud

Reemplazar https://TU-HOST por el valor real del ambiente.

## .json
{
"name": "Nombre Endpoint",
"protocol": "rest",
"baseUrl": "https://TU-HOST",
"request": {
"method": "METODO",
"path": "PATH", EJEMPLO:operatoria-fondos-rest/obtenerOtrosFondosParaInvertir,
"headers": {
"Accept": "application/json"
},
"body": body,
"expectedStatus": cod status esperado
},
"performance": {
"strategy": "sequential",
"injection": {
"type": "tps",
"tps": 10,
"preAllocatedVUs": 5,
"maxVUs": 5,
"rampup": 5,
"duration": 120
}
},
"report": {
"environment": "QA",
"version": "version-del-servicio",
"dataset": "datos-de-prueba-v1"
}
}


## Campos generales

| Campo | Descripción |
|---|---|
| name | Nombre de la prueba y prefijo de reportes. |
| protocol | Debe ser rest para este runner. |
| baseUrl | Dirección base del servicio. |
| headers | Cabeceras generales opcionales. |
| variables | Variables iniciales opcionales. |
| request | Una solicitud, compatible con el formato original. |
| steps | Pasos para sequential o parallel. |
| flows | Flujos para independent o mixed. |
| performance | Modalidad y carga. |
| report | Metadatos de la ejecución. |

Usar una sola estructura principal: request, steps o flows.

## Configuración de carga

| Campo | Descripción |
|---|---|
| type | tps |
| tps | Tasa objetivo de inicios de flujo por segundo. |
| preAllocatedVUs | Usuarios reservados por escenario. |
| maxVUs | Máximo de usuarios por escenario; debe ser mayor o igual a preAllocatedVUs. |
| rampup | Segundos de subida hasta la tasa objetivo. |
| duration | Segundos adicionales manteniendo la tasa objetivo. |
| gracefulStop | Segundos para finalizar iteraciones en curso; 30 por defecto. |

Se admiten tasas por flujo en múltiplos de 0.001 TPS.

## Campos de una solicitud o paso

| Campo | Descripción |
|---|---|
| id | Identificador único dentro del flujo; requerido en steps. |
| method | Método HTTP; GET por defecto. |
| path | Ruta que se agrega a baseUrl. |
| baseUrl | Permite sustituir la dirección base para ese paso. |
| headers | Cabeceras específicas. |
| body | Objeto JSON, cadena o null. |
| expectedStatus | Estado esperado o arreglo de estados; 200 por defecto. |
| timeout | Tiempo máximo; por ejemplo 60s. |
| allowEmptyBody | true permite una respuesta sin cuerpo. |
| extract | Variables que se extraen de la respuesta. |
| assertions | Validaciones sobre campos JSON. |

En el formato request único, el runner asigna el id automáticamente.

Las cabeceras se combinan en este orden:
1. Generales.
2. Del flujo.
3. Del paso.

## Secuencia con dependencia

Usar performance.strategy: sequential y este arreglo steps:

json
[
{
"id": "crear",
"method": "POST",
"path": "operaciones",
"body": {
"referencia": "operacion-{{vu}}-{{iteration}}"
},
"expectedStatus": 201,
"extract": {
"operationId": "id"
}
},
{
"id": "consultar",
"method": "GET",
"path": "operaciones/{{operationId|url}}",
"expectedStatus": 200
}
]


Las rutas y datos de este ejemplo son ilustrativos.

El segundo paso utiliza el id de la respuesta del primero.

## Solicitudes en paralelo

Usar performance.strategy: parallel y un arreglo steps.

Los pasos deben ser independientes entre sí.

También se puede insertar un grupo paralelo dentro de una secuencia:

json
{
"parallel": [
{
"id": "consultarSaldo",
"path": "saldos",
"expectedStatus": 200
},
{
"id": "consultarFondos",
"path": "fondos",
"expectedStatus": 200
}
]
}


Los pasos posteriores esperan a que termine el grupo.

## Escenarios independientes

Usar performance.strategy: independent.

Ejemplo del arreglo flows:

json
[
{
"name": "fondos",
"injection": {
"tps": 7
},
"steps": [
{
"id": "consultar",
"path": "fondos"
}
]
},
{
"name": "saldos",
"injection": {
"tps": 3
},
"steps": [
{
"id": "consultar",
"path": "saldos"
}
]
}
]


Los valores no definidos en la inyección del flujo se toman de la inyección general.

## Mezcla porcentual

Usar performance.strategy: mixed.

Ejemplo del arreglo flows:

json
[
{
"name": "fondos",
"weight": 70,
"steps": [
{
"id": "consultar",
"path": "fondos"
}
]
},
{
"name": "saldos",
"weight": 30,
"steps": [
{
"id": "consultar",
"path": "saldos"
}
]
}
]


Los pesos deben ser positivos y sumar 100.

En mixed no se permite injection dentro de cada flujo. La tasa se obtiene de la inyección general y el peso correspondiente.

Cada flujo puede tener strategy: sequential o parallel; por defecto es sequential.

## Variables

| Sintaxis | Uso |
|---|---|
| {{operationId}} | Valor extraído o variable inicial. |
| {{operationId\|url}} | Valor codificado como componente de URL. |
| {{env.TOKEN}} | Variable de entorno TOKEN. |
| {{vu}} | Identificador del usuario virtual. |
| {{iteration}} | Índice de iteración dentro del escenario. |

Una referencia que ocupa todo el valor conserva el tipo de dato.

Ejemplo:

json
{
"body": {
"id": "{{operationId}}"
}
}


Si operationId es numérico, el cuerpo conserva ese número.

Las variables se reinician por iteración y no se comparten entre escenarios.

## Extracciones

json
{
"extract": {
"operationId": "data.id",
"firstItemId": "items[0].id",
"token": "header:X-Token"
}
}


Las rutas admiten propiedades y posiciones de arreglos. No implementan JSONPath completo.

La extracción se publica únicamente si el paso es válido.

## Assertions

json
{
"assertions": [
{
"path": "data.id",
"exists": true
},
{
"path": "estado",
"equals": "ACTIVO"
}
]
}


exists: true exige un valor distinto de null y undefined.

equals también acepta referencias a variables. Para objetos, la comparación utiliza serialización; se recomienda validar campos escalares.

## Errores frecuentes

- Coma antes de una llave de cierre.
- Comillas simples en JSON.
- Comentarios dentro del JSON.
- Mantener report.criteria.
- Referenciar una variable antes de extraerla.
- Crear dependencias entre pasos del mismo grupo paralelo.
- Pesos que no suman 100.
- maxVUs menor que preAllocatedVUs.
- Duración insuficiente para cumplir minSamples.
- Usar una ruta o un estado HTTP ilustrativo sin adaptarlo al servicio.