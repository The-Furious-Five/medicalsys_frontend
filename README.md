# MedicalSys Frontend

Aplicación web del flujo MVP de MedicalSys. Este repositorio contiene una SPA construida con
Angular que consume exclusivamente el API Gateway de la plataforma de microservicios.

## Estado inicial

La base incluye:

- Angular 22 con componentes standalone y ejecución zoneless.
- TypeScript estricto, routing y SCSS.
- Vitest para pruebas unitarias.
- Proxy local hacia `ms-gateway`.
- `HttpClient` configurado con Bearer token y `X-Correlation-Id`.
- Sesión temporal en `sessionStorage` para el MVP.
- Modelo común del error HTTP acordado.
- Página inicial responsive y estructura orientada a funcionalidades.

Todavía no implementa login ni los casos de negocio. Cada funcionalidad debe agregarse mediante su
historia de usuario y contrato aprobado.

## Requisitos

- Node.js 24.15 LTS recomendado. Angular 22 también admite las versiones indicadas en `engines`.
- npm 10, 11 o 12.
- El backend MedicalSys y su gateway disponibles localmente.

Si utilizas `nvm`:

```bash
nvm install
nvm use
```

## Primera instalación

```bash
git clone https://github.com/The-Furious-Five/medicalsys_frontend.git
cd medicalsys_frontend
npm ci
```

`npm ci` usa `package-lock.json` y garantiza que el equipo instale las mismas versiones. No se debe
subir `node_modules` al repositorio.

## Levantar backend y frontend

En una terminal, desde el repositorio de backend:

```bash
cd ../medicalsys-platform_v1
docker compose up -d
docker compose ps
curl http://localhost:8080/actuator/health
```

En otra terminal, desde este repositorio:

```bash
npm start
```

Abrir:

```text
http://localhost:4200
```

El servidor de Angular reenvía `/api/**` y `/actuator/**` a `http://localhost:8080` mediante
`proxy.conf.json`. Esto evita CORS durante el desarrollo y permite usar URLs relativas.

Si el gateway local utiliza otro puerto, por ejemplo `8088`, cambia únicamente `target` en
`proxy.conf.json`. No cambies las URLs dentro de componentes o servicios.

## Comandos disponibles

| Comando                | Resultado                                          |
| ---------------------- | -------------------------------------------------- |
| `npm start`            | Servidor de desarrollo con proxy al gateway.       |
| `npm run start:open`   | Igual que `start`, abriendo el navegador.          |
| `npm run build`        | Compilación optimizada.                            |
| `npm test`             | Vitest en modo interactivo.                        |
| `npm run test:ci`      | Pruebas ejecutadas una vez.                        |
| `npm run format`       | Formatea el repositorio con Prettier.              |
| `npm run format:check` | Comprueba formato sin modificar archivos.          |
| `npm run check`        | Formato, pruebas y build; ejecutar antes de un PR. |

La caché persistente de Angular está deshabilitada en `angular.json` porque el addon nativo LMDB
abortó el proceso de build en la ruta compartida actual, que contiene espacios. Esto solo hace la
compilación un poco más lenta. Si el equipo clona el repositorio en una ruta simple y confirma que
el build funciona, puede evaluarse `npx ng cache enable` en un PR separado.

## Estructura acordada

```text
src/app/
├── core/                       # Una sola instancia para toda la aplicación
│   ├── auth/                   # Sesión, guards y permisos
│   ├── config/                 # Tokens y configuración global
│   └── http/                   # Interceptors y contratos transversales
├── features/                   # Organización por funcionalidad
│   ├── auth/
│   ├── patients/
│   ├── professionals/
│   ├── scheduling/
│   ├── medical-records/
│   ├── documents/
│   ├── billing/
│   └── audit/
├── shared/                     # UI reutilizable y sin reglas de negocio
├── app.config.ts
└── app.routes.ts
```

Una funcionalidad agrupa sus páginas, componentes, modelos, formularios, cliente HTTP, rutas y
pruebas. No se organiza el proyecto en carpetas globales `components`, `models` y `services`.

Un elemento se mueve a `shared` cuando tiene al menos dos consumidores reales. `shared` no puede
depender de una funcionalidad. `core` tampoco contiene componentes específicos de pacientes,
agenda o facturación.

## Distribución del equipo

La propiedad técnica sigue la distribución del backend. Esto no impide revisar o ayudar en otro
slice.

| Integrante | Funcionalidades principales del frontend                                          |
| ---------- | --------------------------------------------------------------------------------- |
| Juanjo     | Catálogos necesarios para formularios y contratos de criptografía sin UI pública. |
| Franco     | Historial, atención clínica, orden de estudio, tenencia y facturación.            |
| Álvaro     | Login, sesión, identidad, agenda y disponibilidad.                                |
| Nicole     | Pacientes, documentos, gateway e integración del recorrido.                       |
| Jhon       | Profesionales, shell común del frontend y apoyo a evidencia E2E.                  |

Roles transversales:

- **Franco — Tech Lead e Interaction Designer:** define el recorrido, la consecuencia de cada
  acción y los estados esperados.
- **Nicole — Visual Designer:** mantiene tokens, jerarquía, color, contraste y consistencia.
- **Álvaro — Motion Designer:** define transiciones funcionales y respeta `prefers-reduced-motion`.

Los roles revisan las pantallas, pero cada autor sigue siendo responsable de implementar y probar
su funcionalidad.

## Contrato de comunicación

### 1. Solo se consume el gateway

El frontend usa URLs relativas iniciadas en:

```text
/api/v1
```

Está prohibido llamar directamente a:

```text
http://localhost:8081
http://localhost:8085
http://ms-pacientes:8085
```

El navegador tampoco consume `/internal/v1/**`. Esas rutas son exclusivamente entre
microservicios.

Prefijos públicos actuales:

| Área          | Prefijo público                                                                 |
| ------------- | ------------------------------------------------------------------------------- |
| Identidad     | `/api/v1/identity/**`                                                           |
| Tenencia      | `/api/v1/tenancy/**`                                                            |
| Catálogos     | `/api/v1/catalogs/**`                                                           |
| Pacientes     | `/api/v1/patients/**`                                                           |
| Profesionales | `/api/v1/professionals/**`                                                      |
| Agenda        | `/api/v1/scheduling/**`                                                         |
| Historial     | `/api/v1/encuentros/**`, `/api/v1/expedientes/**`, `/api/v1/ordenes-estudio/**` |
| Documental    | `/api/v1/documents/**`                                                          |
| Facturación   | `/api/v1/facturas/**`                                                           |
| Auditoría     | `/api/v1/audit/**`                                                              |

Criptografía no tiene funcionalidad pública de frontend. Debe ser consumida internamente por los
servicios autorizados.

Esta tabla orienta la navegación, pero no reemplaza el contrato de cada endpoint. Antes de crear
una pantalla se deben confirmar método, ruta exacta, rol, request, response y errores con el
backend.

### 2. Autenticación

Las operaciones privadas envían:

```http
Authorization: Bearer <access-token>
```

El interceptor lo agrega automáticamente. No se debe construir el header en cada funcionalidad.

Para el MVP el token se mantiene en `sessionStorage`, no en `localStorage`. Esto es temporal: si el
backend adopta cookies `HttpOnly`, se debe reemplazar la estrategia centralmente en `core/auth`.

No se decodifica el JWT para tomar decisiones de seguridad. El frontend puede ocultar acciones por
usabilidad, pero el gateway y el backend siempre vuelven a autorizar.

### 3. Tenant y actor

`organizationId`, `userId` y roles provienen de la sesión/JWT. No deben enviarse en formularios para
que el usuario elija o suplante una organización. Solo se incluyen en un request si el contrato
congelado lo exige por una razón explícita.

### 4. Correlation ID

Cada request `/api/**` envía:

```http
X-Correlation-Id: <uuid>
```

El interceptor ya lo genera. Ante un error, la interfaz debe mostrar el `correlationId` de forma
copiable para localizar la misma operación en gateway y microservicios.

### 5. Error común

Todos los servicios deben responder al menos:

```json
{
  "timestamp": "2026-08-28T18:03:51Z",
  "status": 409,
  "code": "APPOINTMENT_OVERLAP",
  "message": "El profesional ya tiene una cita en esa franja",
  "correlationId": "147c87d8-e5f4-4d24-a760-4974f8897a0c",
  "path": "/api/v1/scheduling/appointments"
}
```

`details` puede existir como extensión. El tipo base está en `core/http/api-error.ts`. No se debe
mostrar al usuario un stack trace, SQL o mensaje interno.

### 6. Respuestas exitosas

No se inventa un envoltorio `{ data: ... }` si el backend no lo define. Los modelos TypeScript deben
representar exactamente el contrato publicado por el productor.

Convenciones:

- JSON en `camelCase`.
- UUID como `string`; nunca se convierte a número.
- Fecha/hora en ISO 8601 con zona, por ejemplo `2026-08-28T18:03:51Z`.
- Fecha clínica sin hora como `YYYY-MM-DD`.
- El backend calcula importes y totales; el frontend solo los formatea.
- Los valores de enums se tratan como códigos estables, no como etiquetas para mostrar.
- `null`, campo ausente y cadena vacía no son equivalentes.

### 7. Estados HTTP mínimos

| Estado | Manejo esperado                                       |
| -----: | ----------------------------------------------------- |
|  `200` | Lectura o actualización exitosa.                      |
|  `201` | Creación exitosa; conservar el ID/Location.           |
|  `204` | Operación exitosa sin cuerpo.                         |
|  `400` | Mostrar validaciones de negocio/formulario.           |
|  `401` | Limpiar sesión y volver a login.                      |
|  `403` | Mostrar acceso denegado; no redirigir en bucle.       |
|  `404` | Recurso inexistente dentro del tenant actual.         |
|  `409` | Conflicto recuperable, por ejemplo solapamiento.      |
|  `5xx` | Mensaje estable, reintento prudente y correlation ID. |

## Proceso obligatorio antes de implementar una pantalla

1. Identificar la HU y su criterio de aceptación.
2. Dibujar el flujo y estados: carga, vacío, éxito, validación, 401/403, conflicto y error inesperado.
3. Confirmar el contrato en el backend y completar `docs/contracts/README.md`.
4. Crear modelos TypeScript; no reutilizar entidades JPA copiadas.
5. Crear el cliente HTTP dentro de la funcionalidad.
6. Implementar formulario y página con componentes pequeños.
7. Añadir pruebas del caso exitoso y al menos un error relevante.
8. Probar mediante el gateway, nunca con el puerto directo del microservicio.
9. Revisar interacción, consistencia visual y movimiento.
10. Adjuntar evidencia al PR.

## Convenciones Angular y TypeScript

- Usar componentes, directivas y pipes standalone; no crear `NgModule`.
- Organizar por funcionalidad y cargar páginas con rutas lazy.
- Archivos en minúsculas y kebab-case: `patient-form.ts`, `patient-form.html`.
- Mantener juntos TypeScript, HTML, SCSS y `.spec.ts` de un componente.
- Usar `inject()` para dependencias nuevas.
- Usar formularios reactivos y tipados para datos clínicos/administrativos.
- Preferir signals para estado local y RxJS para flujos HTTP/asíncronos.
- No usar `any`; comenzar con `unknown` y validar.
- No colocar reglas de negocio complejas en templates.
- No llamar `subscribe()` dentro de otro `subscribe()`.
- Usar `readonly` cuando una referencia no debe reasignarse.
- No usar `::ng-deep`.
- No añadir una librería global, framework visual o gestor de estado sin decisión del equipo.

## Convenciones visuales y de movimiento

- Los colores compartidos son variables CSS en `src/styles.scss`.
- Cada pantalla debe tener estados loading, vacío, éxito y error.
- La acción principal debe ser evidente y debe explicar su resultado.
- No usar color como única forma de comunicar estado.
- Todo control debe ser accesible por teclado y tener etiqueta.
- Las animaciones deben explicar una transición, no decorar por decorar.
- Respetar siempre `prefers-reduced-motion`.

## Git y colaboración

Crear una rama desde `develop` o desde la rama de integración acordada:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feature/patients-register-ui
```

Nombres recomendados:

```text
feature/patients-register-ui
fix/gateway-error-handling
test/scheduling-overlap
docs/frontend-contracts
```

Antes del push:

```bash
npm run check
git status
```

No subir:

- `node_modules`
- tokens o contraseñas
- archivos `.env` con secretos
- datos o documentos reales de pacientes
- URLs personales codificadas en componentes

## Definition of Done de una funcionalidad

- Cumple el criterio de aceptación de la HU.
- Usa exclusivamente el gateway.
- Contrato y modelos coinciden con el backend.
- Respeta roles y tenant.
- Incluye loading, vacío, éxito y errores importantes.
- Es navegable con teclado y tiene etiquetas accesibles.
- Pruebas verdes y `npm run build` exitoso.
- Revisión de Interaction, Visual y Motion cuando corresponde.
- Evidencia reproducible adjunta.

## Seguridad y datos de prueba

Este es un MVP educativo. Solo se pueden utilizar organizaciones, pacientes, diagnósticos y
documentos ficticios. No registrar JWT, contraseñas, contenido clínico ni datos personales en
`console.log`, capturas públicas, commits o issues.

## Documentación oficial utilizada

- [Angular CLI](https://angular.dev/tools/cli)
- [Compatibilidad de versiones](https://angular.dev/reference/versions)
- [Angular Style Guide](https://angular.dev/style-guide)
- [Routing](https://angular.dev/guide/routing/define-routes)
