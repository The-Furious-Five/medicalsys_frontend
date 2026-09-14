# Ficha de contrato · Bitácora de auditoría

## Historia y responsables

- HU: Como administración de la clínica quiero revisar quién accedió a qué información y cuándo,
  para poder investigar un incidente y demostrar el uso correcto de los datos clínicos.
- Responsable frontend: equipo MedicalSys
- Microservicio productor: `ms-auditoria`
- Revisor del productor: equipo MedicalSys

## Operación

- Objetivo de usuario: filtrar, revisar y exportar la bitácora de la organización.
- Rutas públicas del gateway: `/api/v1/audit/**`
- Roles permitidos: `ADMINISTRATOR`, `PLATFORM_ADMIN`
- ¿Requiere autenticación?: sí
- ¿Es idempotente?: sí, todas las operaciones de la pantalla son `GET`

La escritura de eventos vive en `/internal/v1/audit-events` y **no** está publicada en el gateway.
El navegador no asienta auditoría: una bitácora que el cliente puede redactar no prueba nada.

## Request

Headers:

```http
Authorization: Bearer <token>
X-Correlation-Id: <uuid>
```

`organizationId` no se envía. Sale del JWT y lo propaga el gateway como `X-Organization-Id`.

### `GET /api/v1/audit/events`

| Campo           | Tipo              | Obligatorio | Regla                                                  |
| --------------- | ----------------- | ----------- | ------------------------------------------------------ |
| `from`          | ISO-8601 con zona | no          | Límite inferior inclusivo de `occurredAt`              |
| `to`            | ISO-8601 con zona | no          | Límite superior exclusivo; debe ser posterior a `from` |
| `category`      | enum              | no          | `AUTHENTICATION`…`SYSTEM`                              |
| `outcome`       | enum              | no          | `SUCCESS`, `DENIED`, `FAILURE`                         |
| `severity`      | enum              | no          | `INFO`, `NOTICE`, `WARNING`, `CRITICAL`                |
| `serviceName`   | string(40)        | no          | Coincidencia exacta, p. ej. `ms-pacientes`             |
| `action`        | string(60)        | no          | Coincidencia exacta en mayúsculas                      |
| `resourceType`  | string(60)        | no          | Coincidencia exacta en mayúsculas                      |
| `actorUserId`   | UUID              | no          | Usuario que ejecutó la acción                          |
| `patientId`     | UUID              | no          | Paciente afectado                                      |
| `resourceId`    | UUID              | no          | Recurso concreto afectado                              |
| `correlationId` | string(64)        | no          | Reconstruye un salto entre microservicios              |
| `q`             | string(160)       | no          | Texto libre sobre acción, recurso, actor y motivo      |
| `page`          | int               | no          | Base 0, por defecto `0`                                |
| `size`          | int               | no          | Por defecto `25`                                       |
| `sort`          | string            | no          | Por defecto `occurredAt,desc`                          |

### Otras rutas consumidas

| Método | Ruta                             | Uso en la pantalla                    |
| ------ | -------------------------------- | ------------------------------------- |
| `GET`  | `/api/v1/audit/summary`          | Tarjetas y cortes del encabezado      |
| `GET`  | `/api/v1/audit/integrity`        | Insignia de verificación de la cadena |
| `GET`  | `/api/v1/audit/events/{eventId}` | Detalle puntual (enlace directo)      |
| `GET`  | `/api/v1/audit/events/export`    | Descarga CSV, `Accept: text/csv`      |

## Response exitoso

- Status: `200`

`GET /api/v1/audit/events`:

```json
{
  "content": [
    {
      "eventId": "6f1c2f6e-2f0a-4a5f-9a3f-6c9a1b2c3d4e",
      "sequenceNumber": 42,
      "occurredAt": "2026-09-07T09:00:00Z",
      "recordedAt": "2026-09-07T09:00:01.120Z",
      "serviceName": "ms-historial",
      "action": "MEDICAL_RECORD_VIEWED",
      "category": "AUTHORIZATION",
      "severity": "CRITICAL",
      "outcome": "DENIED",
      "actorUserId": "20000000-0000-4000-8000-0000000000f3",
      "actorDisplayName": "Recepcion Demo",
      "actorRoles": ["RECEPTIONIST"],
      "actorIp": "10.0.0.10",
      "resourceType": "MEDICAL_RECORD",
      "resourcePublicId": "40000000-0000-4000-8000-000000000001",
      "resourceLabel": "Expediente clinico",
      "patientPublicId": "10000000-0000-4000-8000-000000000001",
      "correlationId": "147c87d8-e5f4-4d24-a760-4974f8897a0c",
      "requestMethod": "GET",
      "requestPath": "/api/v1/expedientes/40000000-0000-4000-8000-000000000001",
      "responseStatus": 403,
      "reason": "El rol RECEPTIONIST no puede leer expedientes",
      "metadata": "{\"attempt\":\"1\"}",
      "previousHash": "…64 hex…",
      "recordHash": "…64 hex…"
    }
  ],
  "page": 0,
  "size": 25,
  "totalElements": 1,
  "totalPages": 1
}
```

Notas del contrato:

- `metadata` llega como **texto JSON**, no como objeto. Se muestra tal cual; no se parsea para
  tomar decisiones de interfaz.
- Los campos ausentes se omiten (`default-property-inclusion: non_null`). Ausente, `null` y cadena
  vacía no son equivalentes.
- `previousHash` y `recordHash` se exponen para que un revisor externo pueda recalcular la cadena
  por su cuenta en vez de confiar en la palabra del servicio.

`GET /api/v1/audit/integrity`:

```json
{
  "fromSequenceNumber": 1,
  "toSequenceNumber": 42,
  "verifiedEvents": 42,
  "intact": true,
  "detail": "El tramo verificado encadena correctamente",
  "verifiedAt": "2026-09-07T12:00:00Z"
}
```

## Errores esperados

| Status | `code`                  | Situación                                           | Comportamiento de UI                                           |
| -----: | ----------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
|    400 | `VALIDATION_ERROR`      | Un parámetro excede su longitud o el enum no existe | Aviso con el `code`; el filtro conserva lo escrito             |
|    400 | `MALFORMED_REQUEST`     | UUID o fecha con formato inválido                   | Igual que el anterior                                          |
|    401 | `UNAUTHENTICATED`       | Token ausente, vencido o sin tenant propagado       | Limpiar sesión y volver a login                                |
|    403 | `FORBIDDEN`             | El rol no es `ADMINISTRATOR` ni `PLATFORM_ADMIN`    | Aviso de acceso denegado; **no** redirigir en bucle            |
|    404 | `AUDIT_EVENT_NOT_FOUND` | El evento no existe en esta organización            | Aviso y vuelta al listado                                      |
|    422 | `INVALID_AUDIT_RANGE`   | `from` posterior a `to`, o ventana mayor a 366 días | Señalar el rango en el formulario                              |
|    5xx | `INTERNAL_ERROR`        | Fallo inesperado                                    | Mensaje estable, reintento prudente y `correlationId` copiable |

## Estados de interfaz

- **Inicial:** filtros vacíos, últimos 7 días por defecto en el resumen.
- **Loading:** texto en vivo por sección; el resumen, la tabla y la integridad cargan por separado
  para que un fallo de una no oculte a las otras.
- **Vacío:** mensaje que distingue "sin coincidencias" de "todavía cargando", con una sugerencia de
  ampliar el rango.
- **Éxito:** tabla ordenada del evento más reciente al más antiguo, con conteo total.
- **Validación:** aviso con `code` y `status`.
- **Error recuperable:** banner descartable con `correlationId` copiable.
- **Error inesperado:** mismo banner; nunca stack trace, SQL ni mensaje interno.

## Evidencia

- Prueba automatizada: `src/app/features/audit/audit-page.spec.ts`
- Pruebas del productor: `services/ms-auditoria/src/test/java/com/medicalsys/auditoria/`
- Request/response de ejemplo: incluidos arriba
- Captura o video: pendiente de la demostración integrada
- Correlation ID de prueba: `147c87d8-e5f4-4d24-a760-4974f8897a0c`
