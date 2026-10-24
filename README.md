# MedicalSys Frontend

Aplicación web del flujo MVP de MedicalSys. Este repositorio contiene una SPA construida con
Angular que consume exclusivamente el API Gateway de la plataforma de microservicios.

## Qué implementa

Cubre diez microservicios del MVP:

| Módulo en la interfaz | Microservicio      | Prefijos que consume                                                                                                |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Historial clínico     | `ms-historial`     | `/api/v1/expedientes`, `/encuentros`, `/ordenes-estudio`, `/recetas`, `/diagnosticos`, `/alergias`, `/antecedentes` |
| Organización          | `ms-tenencia`      | `/api/v1/tenancy/**`                                                                                                |
| Facturación           | `ms-facturacion`   | `/api/v1/facturas`                                                                                                  |
| Agenda                | `ms-agenda`        | `/api/v1/scheduling/**`                                                                                             |
| Profesionales         | `ms-profesionales` | `/api/v1/professionals/**`                                                                                          |
| Pacientes             | `ms-pacientes`     | `/api/v1/patients/**`                                                                                               |
| Marketing             | `ms-marketing`     | `/api/v1/campanas`, `/segmentos`, `/promociones`, `/anuncios`, `/fidelidad`, `/pacientes/**`                        |
| Acceso                | `ms-identidad`     | `/api/v1/identity/**`                                                                                               |
| Catálogos clínicos    | `ms-catalogos`     | `/api/v1/catalogs/specialties`, `/cie10`, `/medications`, `/study-types`                                            |
| Auditoría             | `ms-auditoria`     | `/api/v1/audit/events`, `/summary`, `/integrity`, `/events/export`                                                  |

Si `ms-pacientes` no responde, cada vista degrada por su cuenta y muestra el resto de la
información: los demás módulos referencian al paciente solo por UUID.

Nota sobre `/api/v1/pacientes/**`: es de `ms-marketing` (actividad comercial y
opt-out), no de `ms-pacientes`, que vive en `/api/v1/patients/**`. Los dos
prefijos coexisten en el gateway y no colisionan.

La base técnica:

- Angular 22 con componentes standalone, ejecución zoneless y señales.
- `httpResource` para las lecturas: expone `value`, `isLoading`, `error` y
  `reload`, que son exactamente los cinco estados que cada vista dibuja.
- `HttpClient` para las escrituras, con interceptores de Bearer,
  `X-Correlation-Id` y cierre de sesión ante un 401.
- Capas modales sobre el elemento `<dialog>` nativo: trampa de foco, cierre con
  `Esc` y fondo inerte sin dependencias de terceros.
- Formularios reactivos con las mismas restricciones que el backend.
- Carga diferida por ruta.
- Vitest para pruebas unitarias.
- Proxy local hacia `ms-gateway`.
- `HttpClient` configurado con Bearer token y `X-Correlation-Id`.
- Sesión temporal en `sessionStorage` para el MVP.
- Modelo común del error HTTP acordado.
- Recorte funcional de **Catálogos** (`/catalogos`): consulta de especialidades, CIE-10, medicamentos y tipos de estudio a través del Gateway.

Todavía no implementa login ni el resto de casos de negocio. Cada funcionalidad debe agregarse mediante su
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

El servidor de Angular reenvía `/api/**` y `/actuator/**` al gateway mediante
`proxy.conf.mjs`. Esto evita CORS durante el desarrollo y permite usar URLs relativas.

El destino se configura en `.env` (copiar desde `.env.example`):

```dotenv
API_TARGET=http://localhost:8080
```

Sirve tanto para un gateway local en otro puerto como para uno remoto, por ejemplo un túnel
`https://<subdominio>.trycloudflare.com`. Tras editar `.env` hay que reiniciar `npm start`.
No cambies las URLs dentro de componentes o servicios: deben seguir siendo relativas, porque
el interceptor solo adjunta el token `Bearer` a las peticiones que empiezan por `/api/`.

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
│   ├── home/
│   ├── patients/
│   ├── professionals/
│   ├── scheduling/
│   ├── medical-records/
│   ├── billing/
│   ├── marketing/
│   ├── tenancy/
│   ├── catalogs/
│   ├── audit/
│   └── settings/
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

La escritura de la bitácora, `/internal/v1/audit-events`, queda deliberadamente fuera del
gateway: se asienta entre servicios y nunca desde el navegador, o cualquiera podría fabricar la
prueba de lo que no hizo.

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

## Cuentas de demostración

| Cuenta                          | Rol             | Qué ve                                                                                    |
| ------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `admin@medicalsys.demo`         | `ADMINISTRATOR` | Organización, sucursales, prestaciones, plan y consumo, facturación, marketing, historial |
| `doctor@medicalsys.demo`        | `PHYSICIAN`     | Historial clínico completo: escribir, firmar, recetar, pedir estudios                     |
| `recepcion@medicalsys.demo`     | `RECEPTIONIST`  | Pacientes, agenda, expedientes en lectura, órdenes de estudio, facturación, cupones       |
| `caja@medicalsys.demo`          | `BILLING_CLERK` | Facturación, cupones y fidelización                                                       |
| `pediatria@medicalsys.demo`     | `PHYSICIAN`     | Lo mismo que `doctor`, con su propia agenda de pediatría                                  |
| `ginecologia@medicalsys.demo`   | `PHYSICIAN`     | Lo mismo, con la agenda de ginecología                                                    |
| `cardiologia@medicalsys.demo`   | `PHYSICIAN`     | Lo mismo, con la agenda de cardiología                                                    |
| `traumatologia@medicalsys.demo` | `PHYSICIAN`     | Profesional de licencia: su ficha se abre, pero no admite citas                           |
| `nutricion@medicalsys.demo`     | `PHYSICIAN`     | Nutrición                                                                                 |
| `odontologia@medicalsys.demo`   | `PHYSICIAN`     | Odontología                                                                               |

Contraseña: la de `IDENTITY_DEMO_PASSWORD` del backend (en un entorno local nuevo,
`SanGabriel.Demo26!`; en el despliegue público, la que entrega el equipo). El frontend no la
guarda: el botón de cuenta demo completa solo el correo.

El menú lateral muestra solo lo que el rol activo puede usar. Nada aparece
deshabilitado «para que se vea completo»: enseñar puertas cerradas no ayuda a
nadie a hacer su trabajo.

## Guion de demostración

1. **Acceso** — entra como `doctor@medicalsys.demo`. El panel de inicio muestra
   los encuentros sin firmar y los resultados de estudio disponibles.
2. **Paciente** — `Pacientes`, busca por nombre o documento, abre su ficha. Si
   intentas registrar a alguien con un documento ya existente, el conflicto
   aparece sobre el campo del documento con un acceso a la ficha que ya existe.
3. **Expediente** — desde la ficha, _Abrir expediente_. Es idempotente: si la
   persona ya tiene uno, se abre el que existe.
4. **Alergias y antecedentes** — en las pestañas del expediente. Las alergias
   activas pasan a verse destacadas durante cada encuentro.
5. **Encuentro clínico** — _Abrir encuentro_. La columna izquierda mantiene el
   contexto del paciente; la derecha es donde se escribe. La nota se guarda sola
   dos segundos después de dejar de escribir, con un indicador textual discreto.
6. **Signos vitales, diagnósticos, recetas y órdenes** — cada panel del
   encuentro. Los códigos se validan contra `ms-catalogos` por HTTP
   (`CATALOGS_VALIDATION_MODE=REMOTE`), así que vale cualquier código del
   catálogo vigente: 18 códigos CIE-10, 10 tipos de estudio y 14 medicamentos.
   Un código inexistente se rechaza con `ICD10_CODE_NOT_ALLOWED`.
7. **Firma** — la confirmación explica en texto claro que el contenido queda
   inmutable. Tras firmar, la pantalla pasa a solo lectura y aparece
   _Agregar addendum_.
8. **Resultado de estudio** — en la orden, _Registrar resultado_. Con referencia
   mínima y máxima, el sistema marca solo si el valor queda fuera de rango.
9. **Factura** — entra como `admin` o `recepcion`, _Emitir factura_, elige al
   paciente y añade prestaciones. El total se ve siempre a la derecha. Desde la
   factura emitida, _Imprimir_ manda al papel solo el comprobante: ni barra
   lateral, ni cabecera, ni botones.
10. **Organización** — `admin` edita el centro, da de alta sucursales, mantiene
    el catálogo con sus precios en BOB y consulta el consumo del plan.

## Decisiones de diseño

### La paleta sale de la marca

El isotipo de MSYS es una mano que sostiene dos hojas dentro de un círculo
abierto. De ahí salen los dos únicos colores del producto:

- **Verde `#1C7F60`** — la mano y la hoja madura: el cuidado sostenido, lo que
  ya está resuelto y firmado. Es el color primario.
- **Naranja `#E57833`** — la hoja joven: lo que todavía crece y necesita
  atención. Es el color de un borrador, un pendiente, un aviso.

El resto es neutro. El color señala estado, nunca decora.

**Los colores van en sólido, no en tinte.** Los sitios donde la marca lleva el
peso son pocos y están elegidos: el elemento activo de la navegación, el avatar
de la cuenta, los accesos rápidos del inicio, los botones de acción primaria y
los números de paso. Ahí el verde va a plena fuerza con texto blanco (4.9:1).
Todo lo demás sigue siendo neutro: una pantalla en reposo no compite con el
trabajo que hay encima. Los tintes claros existen solo como fondo de chip, y un
escalón más abajo de donde estaban —fondo `-100`, texto `-800`— porque con `-50`
y `-700` el estado se leía como un susurro y el conjunto tiraba a menta.

**El naranja tiene una regla propia.** Con 2.97:1 sobre blanco no puede ser
texto ni una marca pequeña sobre una superficie clara: como punto de 6 px o
barra fina desaparece. Los puntos de estado y las barras de consumo usan un
escalón más oscuro del mismo naranja, que sí se distingue. El `#E57833` exacto
se reserva para donde rinde a plena fuerza sin llevar texto encima: la línea de
la hora actual en la agenda y el punto de las citas en sala, que son las marcas
que no deben pasar desapercibidas.

El rojo de error se aleja deliberadamente del naranja en tono para que aviso y
error nunca se confundan, y ningún estado se comunica solo con color: todo chip
lleva su texto.

Contrastes verificados por cálculo, en claro y en oscuro: texto blanco sobre el
verde de marca 4.9:1, chips 7.2–9.1:1, enlaces 8.9:1, puntos de estado 3.3–6.6:1.

### Los archivos de marca

`public/brand/` contiene tres: el logotipo horizontal (barra lateral, acceso y
factura), el isotipo (columna del acceso) y el isotipo en pastilla (barra
contraída y favicon). Son copias de `marca/`, normalizadas a los hexadecimales
declarados arriba —la diferencia con los del archivo original es imperceptible,
pero tener dos verdes en el código sí se nota al mantenerlo—. **`marca/` no se
modifica.**

Sobre el raíl oscuro el verde de marca cae a 3.6:1 y el logotipo se lee turbio,
así que en modo oscuro se aclara por filtro sin tocar el tono. Cuando exista una
versión clara del logotipo en `marca/`, esto se sustituye por ese archivo.

### El modo claro es el predeterminado, siempre

La aplicación arranca en claro y **no** consulta `prefers-color-scheme`: en un
centro médico la pantalla se comparte entre turnos y el aspecto debe ser el
mismo para todos hasta que alguien elija otra cosa en _Configuración_. El
atributo `data-theme="light"` viaja escrito en `index.html`, así que ni siquiera
hay un destello oscuro antes de que Angular monte en un equipo configurado en
oscuro. La elección se guarda por navegador; desde otro equipo se vuelve a abrir
en claro.

### Dónde vive cada cosa en el armazón

La cabecera queda para el trabajo —buscar y saber si el sistema responde—.
Contraer la barra lateral acompaña a la marca, arriba a la izquierda, porque es
una preferencia del marco y no una acción del trabajo. Todo lo que es «tu
cuenta» cierra la barra lateral: quién ha iniciado sesión, su rol, el acceso a
_Configuración_ y el cierre de sesión. En un puesto compartido, poder comprobar
de un vistazo con qué cuenta se está trabajando importa más que tener un avatar
en la esquina.

### Forma y movimiento

Cuadrada sin ser dura: radios de 3 px en chips, 4 px en controles, 6 px en
tarjetas y 8 px en diálogos. Elevación por borde antes que por sombra, y ninguna
sombra con tinte. Espaciado en escala de 4 px, fila de tabla de 44 px, control
estándar de 34 px que crece a 44 px en pantallas táctiles.

La animación existe para explicar de dónde viene y a dónde va un elemento. Solo
`transform` y `opacity`; nada supera 320 ms; salir es un 25 % más rápido que
entrar. `prefers-reduced-motion` se resuelve en el token, no componente por
componente.

### Ningún componente del navegador

La interfaz no usa piezas que dibuje el sistema operativo. Un `<select>`, un
`<input type="date">` o una casilla nativa cambian de forma, de tipografía y de
idioma entre macOS, Windows, Chrome, Safari y Android: el producto dejaría de
verse igual para dos personas del mismo centro.

| Pieza nativa                                      | Sustituto                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<select>` (23 controles)                         | `medsys-select` — `role="combobox"` con lista asociada, flechas, Inicio y Fin, escritura para saltar a una opción, `Esc` para cerrar, y apertura hacia arriba cuando no cabe hacia abajo. Implementa `ControlValueAccessor`, así que funciona con `formControlName` igual que el nativo |
| `<input type="date">`                             | `medsys-date-field` — se escribe en `dd/mm/aaaa` y el calendario está para cuando se prefiere señalar. Los años van por décadas, porque la fecha más tecleada aquí es una de nacimiento                                                                                                 |
| Casilla nativa                                    | Entrada real oculta para el teclado y los lectores de pantalla, con la caja dibujada por el sistema de diseño                                                                                                                                                                           |
| Flechas del campo numérico y aspa del de búsqueda | Retiradas                                                                                                                                                                                                                                                                               |
| Atributo `title`                                  | `medsysTooltip` — el nativo tarda casi un segundo, no admite estilo y no aparece nunca con el foco del teclado; en la barra contraída era la única forma de saber a dónde lleva cada icono                                                                                              |

Se conserva el elemento `<dialog>` para las capas modales: no dibuja ninguna
pieza visible —la superficie, el fondo y la animación son de este sistema— y a
cambio aporta trampa de foco, cierre con `Esc` y fondo inerte, que reimplementar
a mano sale peor.

### Nada de desarrollo en la interfaz

No hay panel técnico, ni vista del estado de los microservicios, ni latencias,
ni identificadores en hexadecimal a la vista. Cuando algo falla, la sección
afectada lo explica en español y ofrece _Reintentar_ y _Copiar detalles_, que
pone en el portapapeles un resumen legible con la referencia para soporte. Un
paciente que no se puede resolver se muestra como «Paciente sin identificar»,
no como un fragmento de UUID.

### Cuándo un elemento reacciona al puntero

El hover sirve para tres cosas y solo para esas tres:

1. **Confirmar el objetivo** antes de pulsar, en listas y tablas densas donde es
   fácil abrir la fila equivocada.
2. **Anunciar que algo va a ocurrir** al pulsar: un botón, un enlace, un control
   que abre una capa.
3. **Revelar un control** que se mantiene callado a propósito, como el de
   contraer la barra lateral.

Lo que no entra en ninguna, no reacciona. Un campo de texto no reacciona: su
borde ya dice que es un campo, al pulsarlo no ocurre nada salvo recibir el foco,
y hacerlo reaccionar convierte recorrer un formulario con el ratón en una
sucesión de destellos. Lo que sí se ve con fuerza ahí es el foco, que es cuando
importa. La sección activa del menú tampoco reacciona: es donde ya estás, y
prometer un cambio que no llega desorienta. Las tarjetas, las cabeceras, los
chips y las celdas de tabla no pulsables se quedan quietas.

Y cada reacción cambia **una** propiedad. Dos a la vez no informan del doble,
solo pesan el doble.

### Estados

Cada vista con datos implementa los cinco: carga con esqueleto de la forma real
del contenido, vacío por primera vez, vacío por filtro, error y degradación
parcial por sección. Los mensajes distinguen _no tienes permiso_ (403), _no
existe_ (404), _conflicto_ (409/422), _datos inválidos_ (400) y _el servicio no
responde_ (0 o 5xx), y muestran el `X-Correlation-Id`, copiable, para que
soporte encuentre el caso exacto. Nunca se imprime un JSON crudo ni un rastro de
pila.

### Máquinas de estado

`src/app/core/state/state-machines.ts` replica las de `ms-historial` leídas del
código (`EncounterStatus`, `StudyOrderStatus`, `PrescriptionStatus`), no de la
documentación, que difería en el ciclo de la orden de estudio. La interfaz solo
ofrece transiciones válidas: un destino imposible no se muestra deshabilitado ni
se muestra y falla — no se muestra. Así nadie provoca un 422 pulsando lo que la
pantalla le ofrecía.

## Estructura

```
src/
  styles/                 tokens, base y primitivos del sistema de diseño
  app/
    core/                 sesión, permisos, HTTP, formato, textos, máquinas de estado, tema, avisos, iconos
    layout/               armazón, navegación por rol, buscador global, estado del sistema
    shared/               diálogo, cabecera, chip de estado, vacíos, errores, esqueletos, paginación
    features/
      auth/               acceso
      home/               panel de inicio por rol
      settings/           configuración personal: apariencia y datos de la cuenta
      patients/           apoyo: búsqueda, ficha y alta de pacientes
      medical-records/    ms-historial: expedientes, encuentros, órdenes de estudio
      billing/            ms-facturacion: listado, emisión y detalle de facturas
      tenancy/            ms-tenencia: organización, sucursales, prestaciones, plan y consumo
```

Los nombres de archivo y de símbolo van en inglés; todo el texto visible está en
español y centralizado en `core/labels/labels.ts` para poder revisarlo de una
sola pasada.

## Atajos

| Atajo           | Qué hace                                                              |
| --------------- | --------------------------------------------------------------------- |
| `⌘K` / `Ctrl+K` | Buscador global de pacientes, prestaciones y secciones                |
| `/`             | Enfoca la búsqueda de la vista actual                                 |
| `↑` `↓` `↵`     | Recorre y abre resultados en el buscador y en el selector de paciente |
| `Esc`           | Cierra la capa superior                                               |

## Limitaciones conocidas del entorno

Ninguna depende de esta interfaz; se listan porque se ven al usarla.

1. **`ms-pacientes` no compila** en `develop` del backend:
   `api/PatientController.java` llama a `PatientService.getByDocument(...)`, que
   no existe, y además duplica el `@RequestMapping("/api/v1/patients")` de
   `web/controller/PatientController.java`. `docker compose up --build` falla por
   completo por este servicio. Mientras no se corrija, levanta solo los que esta
   interfaz necesita; los nombres de paciente se muestran como identificador
   abreviado y el resto de cada vista sigue funcionando.
2. **El listado de órdenes de estudio devuelve 500** cuando la base contiene
   resultados escritos por una ejecución anterior del contenedor.
   `LocalNarrativeCipher` usa una clave efímera: al reiniciar `ms-historial` la
   clave cambia y las filas antiguas ya no se descifran; como `StudyOrderMapper`
   descifra cada resultado al listar, una sola fila vieja tumba la página
   entera. El detalle de cada orden sí funciona. Se resuelve recreando el volumen
   (`docker compose down -v`) o fijando una clave estable.
3. En modo `CATALOGS_VALIDATION_MODE=LOCAL`, los códigos CIE-10 aceptados son
   `J00`, `M54.5`, `R51` y `S52.50`, y los de estudio `X_RAY` y `LAB_HEMOGRAM`.
