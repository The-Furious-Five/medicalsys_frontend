# Catálogos clínicos

## Historia y responsables

- HU: Consulta de catálogos del MVP (especialidades, CIE-10, medicamentos y tipos de estudio).
- Responsable frontend: Juanjo
- Microservicio productor: `ms-catalogos`
- Revisor del productor: contrato público en los controladores de `services/ms-catalogos`

## Operación

- Objetivo de usuario: consultar referencias clínicas vigentes para formularios del MVP.
- Método: `GET`
- Rutas públicas del gateway:
  - `/api/v1/catalogs/specialties`
  - `/api/v1/catalogs/cie10?q={texto}`
  - `/api/v1/catalogs/medications`
  - `/api/v1/catalogs/study-types`
- Roles permitidos: consulta abierta en el MVP (`ms-gateway` permite las rutas públicas de catálogos).
- ¿Requiere autenticación?: no en el recorte actual; el interceptor envía Bearer solo si hay sesión.
- ¿Es idempotente?: sí

## Request

Headers:

```http
X-Correlation-Id: <uuid>
```

Path/query params:

| Campo | Tipo   | Obligatorio | Regla                                      |
| ----- | ------ | ----------- | ------------------------------------------ |
| `q`   | string | CIE-10 sí   | Código o descripción; vacío devuelve `[]`. |

Body: ninguno.

## Response exitoso

- Status: `200`
- Cuerpos: arreglos JSON en `camelCase` (`SpecialtyDto`, `Icd10Dto`, `MedicationDto`, `StudyTypeDto`).
- CIE-10 limita a 20 coincidencias.

## Errores esperados

| Status | `code`                    | Situación                         | Comportamiento de UI                          |
| -----: | ------------------------- | --------------------------------- | --------------------------------------------- |
|      0 | `NETWORK_ERROR`           | Gateway caído o proxy sin destino | Banner con reintento y estado “Sin Gateway”.  |
|    404 | `ICD10_NOT_FOUND`         | Detalle por código inexistente    | No se usa en el listado; la búsqueda da `[]`. |
|    5xx | `CATALOGS_REQUEST_FAILED` | Fallo del servicio o del gateway  | Banner estable, correlation ID copiable.      |

## Estados de interfaz

- Inicial: pestaña Especialidades y carga de los tres listados.
- Loading: “Cargando…” / “Buscando diagnósticos…”.
- Vacío: mensaje por catálogo o por filtro.
- Éxito: tabla con conteo filtrado.
- Error recuperable: reintentar.
- Error inesperado: mensaje estable + correlation ID.

## Evidencia

- Pruebas: `catalogs-api.service.spec.ts`, `catalogs-page.spec.ts`, `catalogs-error.spec.ts`
- Recorrido local: `http://localhost:4200/catalogos` vía proxy `/api` → `ms-gateway:8080`
