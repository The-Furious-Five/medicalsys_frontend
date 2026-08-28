# Ficha de contrato frontend ↔ gateway

Antes de implementar una pantalla, copiar esta ficha en un archivo con nombre funcional, por
ejemplo `patients-create.md`. La información debe validarse con el código/OpenAPI del productor y
con su consumidor; no se completa por suposición.

## Historia y responsables

- HU:
- Responsable frontend:
- Microservicio productor:
- Revisor del productor:

## Operación

- Objetivo de usuario:
- Método:
- Ruta pública del gateway:
- Roles permitidos:
- ¿Requiere autenticación?:
- ¿Es idempotente?:

## Request

Headers:

```http
Authorization: Bearer <token>
X-Correlation-Id: <uuid>
Content-Type: application/json
```

Path/query params:

| Campo | Tipo | Obligatorio | Regla |
| ----- | ---- | ----------- | ----- |
|       |      |             |       |

Body:

```json
{}
```

## Response exitoso

- Status:
- Header `Location`, si corresponde:

```json
{}
```

## Errores esperados

| Status | `code` | Situación | Comportamiento de UI |
| -----: | ------ | --------- | -------------------- |
|    400 |        |           |                      |
|    401 |        |           |                      |
|    403 |        |           |                      |
|    404 |        |           |                      |
|    409 |        |           |                      |

## Estados de interfaz

- Inicial:
- Loading:
- Vacío:
- Éxito:
- Validación:
- Error recuperable:
- Error inesperado:

## Evidencia

- Prueba automatizada:
- Request/response de ejemplo:
- Captura o video:
- Correlation ID de prueba:
