# Runner REST de performance con k6

## Objetivo

Ejecutar pruebas de performance REST a partir de archivos JSON, sin modificar el runner para cada servicio.

Permite:
- Ejecutar una solicitud.
- Ejecutar secuencias con dependencias.
- Ejecutar solicitudes en paralelo.
- Ejecutar escenarios independientes.
- Distribuir carga entre flujos mediante porcentajes.
- Generar reportes HTML y JSON.
- Aplicar criterios globales de aceptación.

Esta versión no ejecuta gRPC.

## Requisitos

- k6 instalado.
- Acceso de red al servicio.
- Datos y credenciales válidos para el ambiente.
- Archivos rest-runner-v2.js y performance-policy.js en la misma carpeta.
- Un JSON con la configuración de la prueba.

El nombre del archivo de política debe coincidir exactamente con el import del runner, incluyendo mayúsculas y minúsculas.

## Ejecución

Desde la carpeta del runner:

bash
k6 run -e SCENARIO=caso.json rest-runner-v2.js


SCENARIO identifica el JSON que se cargará.

Las rutas relativas utilizadas por open() se resuelven respecto del script.

Si el runner tiene otro nombre, reemplazar rest-runner-v2.js por ese nombre en el comando.

## Modalidades

| strategy | Comportamiento |
|---|---|
| sequential | Ejecuta los pasos en orden y espera cada respuesta. |
| parallel | Ejecuta los pasos mediante un lote paralelo. |
| independent | Crea un escenario por flujo, con carga configurable por separado. |
| mixed | Distribuye los TPS globales entre flujos según sus pesos. |

Los usuarios concurrentes están disponibles en todas las modalidades. No requieren un valor especial de strategy.

### Secuencial

Cada usuario ejecuta A → B → C.

Un paso puede extraer información de su respuesta para utilizarla en pasos posteriores.

Por defecto, si un paso falla, no se ejecutan los siguientes pasos de ese flujo.

### Paralelo

Las solicitudes del grupo se preparan con las variables disponibles antes de iniciar el grupo.

Un paso no puede depender de la respuesta de otro paso del mismo grupo paralelo.

La concurrencia del lote está limitada por:
- batch: 20 por defecto.
- batchPerHost: 6 por defecto.

Un lote puede ejecutarse en varias tandas; no garantiza simultaneidad exacta.

### Independiente

Cada flujo tiene su propio escenario.

Su configuración injection se combina con la configuración general. Los valores del flujo tienen prioridad.

Los TPS de los distintos escenarios se suman.

### Mixto

Los pesos de los flujos deben ser positivos y sumar 100.

Ejemplo:
- TPS globales: 10.
- Consultas: peso 70 → objetivo 7 flujos/s.
- Operaciones: peso 30 → objetivo 3 flujos/s.

La distribución se implementa con tasas por escenario, no mediante selección aleatoria.

## Cómo interpretar TPS

Una iteración equivale a un flujo completo.

- Una solicitud por flujo y 10 TPS: aproximadamente 10 solicitudes/s.
- Tres solicitudes por flujo y 10 TPS: aproximadamente 30 solicitudes/s si todos los pasos se ejecutan.

Los errores, pasos omitidos y tiempos de respuesta afectan la carga realmente observada.

Los TPS no se multiplican por la cantidad de VUs.

## Usuarios virtuales

- preAllocatedVUs: usuarios reservados al inicio.
- maxVUs: máximo de usuarios disponibles para el escenario.

En pruebas independent y mixed, estos valores se aplican por escenario.

Ejemplo: tres escenarios con maxVUs: 20 permiten un máximo configurado total de 60 VUs.

Si todos los usuarios están ocupados cuando debe comenzar otra iteración, pueden producirse dropped_iterations.

## Duración

Todos estos valores se expresan en segundos:

- rampup: subida lineal desde cero hasta la tasa objetivo.
- duration: tiempo adicional manteniendo la tasa objetivo.
- gracefulStop: tiempo disponible para finalizar iteraciones en curso.

Duración programada:

text
rampup + duration


gracefulStop puede extender el tiempo hasta la finalización.

## Reportes

Se generan en el directorio desde el que se ejecutó el comando:

- <nombre>-k6-report.html: resumen visual.
- <nombre>-k6-summary.json: métricas de k6.
- <nombre>-execution.json: configuración de evaluación y resultados por flujo.

Repetir una ejecución con el mismo nombre reemplaza esos archivos.

El reporte incluye:
- Flujos iniciados y finalizados.
- Solicitudes contabilizadas.
- Errores de solicitudes y flujos.
- p95 de solicitudes por flujo.
- Porcentaje de carga iniciada.
- Criterios globales y versión de la política.
- Umbrales fallidos.

“Finalizados” incluye flujos exitosos y fallidos.

Esta versión genera su propio reporte. No utiliza collector.js ni report.js anteriores.

## Alcance de las métricas

Los percentiles incluyen las solicitudes del ramp-up y del período de carga estable.

Los criterios de aceptación se evalúan globalmente, aunque el reporte muestre resultados separados por flujo.

request_count contabiliza pasos HTTP intentados. Puede diferir de http_reqs, por ejemplo, por redirecciones.

Un error preparando variables puede fallar el flujo antes de intentar una solicitud.

## Limitaciones

- No comparte variables entre escenarios ni entre usuarios.
- Las variables se reinician en cada iteración.
- Solo admite inyección por TPS en esta versión.
- No compara automáticamente con una ejecución baseline.
- La latencia HTTP no equivale al tiempo interno exclusivo del microservicio.
- Debe validarse en el ambiente objetivo antes de utilizarse como control oficial.