> Matriz vigente: 15 roles con nombres y modelos del archivo «Matriz de Roles.xlsx», aplicada por V11 de ms-identidad.
> Los detalles y las dependencias de lectura están en `medicalsys-platform_v1/docs/seguridad/matriz-roles/README.md`.

# RBAC-05 — Pantallas de roles y matriz de accesos

**Issue:** SINS-43 · **Sección del informe:** 9.2 · **Depende de:** RBAC-02 (API de gestión de roles) y RBAC-03 (autorización por permisos)

Los roles, sus permisos y su asignación se administran desde la aplicación, sin Postman ni base de datos. La interfaz también deja de decidir por el nombre del rol: muestra lo que permiten los permisos del token. Así, un cambio en la matriz se ve en el siguiente inicio de sesión, en el backend y en la interfaz.

## Pantallas

Están en el grupo **Sistema** del menú. Las sirve ms-identidad a través del gateway (`/api/v1/identity/**`).

| Pantalla            | Ruta                | Para verla                                  | Para editar                    |
| ------------------- | ------------------- | ------------------------------------------- | ------------------------------ |
| Roles               | `/roles`            | `identity.role.read`                        | `identity.role.manage` (crear) |
| Ficha del rol       | `/roles/:code`      | `identity.role.read`                        | `identity.role.manage`         |
| Matriz de accesos   | `/matriz-accesos`   | `identity.role.read`                        | `identity.role.manage`         |
| Asignación de roles | `/asignacion-roles` | `identity.user.read` e `identity.role.read` | `identity.role.assign`         |

- **Roles:** lista de roles con alcance, cantidad de permisos, delegación y estado. El rol nuevo nace activo, sin permisos y sin delegar.
- **Ficha del rol:**
  - datos y activación (los roles de sistema no se desactivan);
  - a quién puede asignar (delegación) y con qué roles es incompatible (segregación de funciones);
  - sus permisos agrupados por módulo, en modo de solo lectura.
- **Matriz de accesos:** un rol por columna y un permiso del catálogo por fila, agrupados por módulo, con las columnas C/R/U/D/Aprobar/Ejecutar del Anexo B de PO-02.
  - Se marca por casilla o por módulo entero.
  - Al guardar, cada rol modificado recibe su conjunto completo (`PUT /roles/{code}/permissions`), uno por uno. Si el servicio rechaza un rol, ese rol conserva sus cambios marcados y los demás quedan guardados.
  - Exporta a CSV y a Excel (`.xlsx`).
- **Asignación de roles:** cuentas visibles para quien consulta, con sus roles y la vigencia de cada uno (vigente, programada, vencida o rol inactivo).
  - En la hoja de cada cuenta se asigna un rol con fecha de inicio y, opcionalmente, de fin, y se revoca otro.
  - Crear o desactivar cuentas es de IAM-06.

## La interfaz sigue a los permisos

`src/app/core/auth/permissions.ts` exige, para cada pantalla y cada botón, el permiso del endpoint que usa, tomado de la hoja endpoint → permiso de RBAC-01. El menú, los guards de ruta y los botones leen `AuthSession.permissions()`, no los roles.

Para los seis roles de sistema la vista no cambia, salvo en cinco casos. En todos, la interfaz ofrecía algo que el backend ya rechazaba:

| Antes                                        | Ahora                 | Por qué                                                                                                                 |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| BILLING_CLERK veía **Pacientes**             | No la ve              | ms-pacientes nunca se lo permitió: no tiene `patients.patient.read` (lo anotó RBAC-01)                                  |
| PHYSICIAN veía **Registrar paciente**        | No lo ve              | El alta exige `patients.patient.create`, que tienen PA, AD y RE                                                         |
| BILLING_CLERK veía **Fidelización**          | No la ve              | La pantalla abre con los programas (`marketing.loyalty_program.read`) y busca pacientes: las dos consultas le daban 403 |
| BC, AD y PA veían **Anular factura y notas** | Nadie las ve          | ms-facturacion no publica esos endpoints (respondían 404). Cuando existan, su permiso entra al catálogo                 |
| PATIENT                                      | Recibe `manageOptOut` | No hay cambio visible: el botón está dentro de Actividad comercial, que el paciente no abre                             |

Un rol nuevo ve exactamente lo que alcanzan sus permisos. Por ejemplo, un AUDITOR con `audit.log.read` ve solo **Auditoría**.

## Reglas que la interfaz anticipa

`access-rules.ts` replica las reglas de `RoleGovernance` (RBAC-02) para no ofrecer lo que el servicio rechazaría. Cada bloqueo explica su motivo con un aviso o una descripción emergente:

| Regla                                                                               | Efecto en pantalla                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Nadie edita un rol que tiene asignado                                               | Columna y ficha en solo lectura                             |
| Nadie edita un rol con permisos de gestión (IDENTITY, TENANCY) que no tiene         | Columna y ficha en solo lectura                             |
| Solo se agregan permisos que quien edita ya tiene                                   | Casilla deshabilitada para agregar (quitar sigue permitido) |
| Solo se asignan roles delegados; uno de plataforma, solo desde un rol de plataforma | El selector ofrece únicamente esos                          |
| Nadie gestiona su propia cuenta, ni una con permisos de gestión que no tiene        | Hoja de la cuenta en solo lectura                           |

El servicio sigue decidiendo. Si algo se escapa (por ejemplo, un par de roles incompatibles), la pantalla muestra su mensaje. Para eso `describeFailure` aprendió a leer `ProblemDetail`, que es como responde ms-identidad: antes sus motivos llegaban como un «conflicto» genérico.

## Exportación

| Formato | Contenido                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSV     | La matriz: `Módulo, Permiso, Descripción, Sensible, Columna` y una columna por rol con `X`. UTF-8 con BOM (para que Excel respete las tildes), RFC 4180     |
| Excel   | Hoja **Matriz** (la misma tabla, con el encabezado fijo) y hoja **Roles** (alcance, estado, si es de sistema, cantidad de permisos y a quién puede asignar) |

- **Qué se exporta:** siempre lo guardado, nunca el borrador. Los botones esperan a que no haya cambios pendientes. Es la tabla con la que la matriz aprobada (RBAC-06) debe coincidir 1:1.
- **Protección del CSV:** una celda que empieza con `=`, `+`, `-` o `@` se antepone con un apóstrofo, para que la hoja de cálculo no la ejecute como fórmula (inyección CSV). Un nombre de rol lo escribe una persona.
- **Protección del Excel:** las celdas son texto en línea (`inlineStr`), nunca fórmulas.
- **Cómo se genera el `.xlsx`:** sin librerías. Es un ZIP sin compresión de XML (`xlsx.ts`). Se verificó que lo abren openpyxl y LibreOffice, y que la hoja coincide celda a celda con el CSV.

## Demostración del criterio de aceptación

> Quitar un permiso en la matriz hace que el usuario reciba 403 en esa funcionalidad tras volver a iniciar sesión.

1. **Estado inicial:** `recepcion@medicalsys.demo` abre un expediente y ve las alergias del paciente.
2. **Quitar el permiso:** quien tenga `identity.role.manage` y no tenga RECEPTIONIST abre **Matriz de accesos**, desmarca `clinical.allergy.read` en la columna RECEPTIONIST y guarda. La cuenta de demostración `PLATFORM_ADMIN` cumple las dos condiciones.
3. **Volver a iniciar sesión:** recepción vuelve a entrar. Si tenía una sesión abierta, ms-identidad se la cerró al quitar el permiso. Con la sesión nueva, el expediente sigue abriendo, pero el panel de alergias muestra _Sin permiso para esta sección_, porque ms-historial respondió 403.
4. **Restaurar:** se vuelve a marcar la casilla y, tras un nuevo inicio de sesión, recepción vuelve a ver las alergias.

Si se quita un permiso que tiene pantalla propia, como `patients.patient.read`, la entrada desaparece del menú. Quien entre por URL llega a _Sin permiso_, y la API responde 403 (ver `docs/seguridad/rbac-03-permisos-en-vivo.sh` en la plataforma).

### Verificación en vivo

**Entorno:**

- El frontend de esta rama, contra ms-identidad, ms-tenencia, ms-pacientes, ms-historial y el gateway construidos desde `develop`, que ya incluye RBAC-03.
- MySQL y Redis locales.
- Las cuentas de demostración y PLATFORM_ADMIN sembradas por el servicio.

| Paso                                                                               | Resultado                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PLATFORM_ADMIN abre la matriz                                                      | 169 permisos y 6 roles. Su propia columna aparece bloqueada (candado), por segregación de funciones                                        |
| Quita `clinical.allergy.read` a RECEPTIONIST y guarda                              | `PUT` de un solo rol; la casilla deja de figurar como cambio pendiente                                                                     |
| Recepción inicia sesión y abre un expediente con alergias                          | Panel de alergias: _La identidad autenticada no tiene el permiso clinical.allergy.read…_ (403 de ms-historial)                             |
| Se vuelve a marcar y guardar                                                       | Recepción recupera las alergias en el siguiente inicio de sesión                                                                           |
| Se crea AUDITOR desde **Nuevo rol** y se lo declara incompatible con ADMINISTRATOR | El código se escribe en mayúsculas; el par queda registrado con su motivo                                                                  |
| La casilla de módulo de Auditoría marca los 3 permisos de AUDITOR                  | Se guardan en un solo `PUT`                                                                                                                |
| Asignar AUDITOR a `admin@`                                                         | Rechazado (409), con el motivo del servicio: el par incompatible y la razón declarada                                                      |
| Asignar AUDITOR a `caja@` con vigencia hasta el 31/12/2026                         | Asignación vigente. Al entrar, caja ve **Auditoría** y ya no **Pacientes** ni **Fidelización**                                             |
| Revocar AUDITOR                                                                    | Confirmación y asignación eliminada                                                                                                        |
| `admin@` abre la matriz y la asignación                                            | Matriz de solo lectura. La cuenta de PLATFORM_ADMIN queda bloqueada (permisos de gestión que no tiene)                                     |
| Exportar CSV y Excel                                                               | Las X por rol coinciden con `GET /roles` para los 7 roles. El `.xlsx` lo abren openpyxl y LibreOffice, y coincide celda a celda con el CSV |

## Pruebas

| Archivo                         | Qué fija                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/auth/permissions.spec.ts` | Un rol nuevo ve solo lo que alcanzan sus permisos. Quitar un permiso oculta su pantalla. Cada acción exige el permiso de su endpoint.                                                             |
| `access-matrix.spec.ts`         | Columna C/R/U/D/Aprobar/Ejecutar de cada acción, cálculo de cambios por rol, tabla exportada y CSV a prueba de fórmulas.                                                                          |
| `xlsx.spec.ts`                  | El libro es un ZIP válido (firmas y CRC de cada parte), sus celdas son texto escapado y las columnas se nombran como en Excel.                                                                    |
| `access-rules.spec.ts`          | Las reglas de `RoleGovernance` anticipadas y el estado de cada asignación.                                                                                                                        |
| `access-matrix-page.spec.ts`    | Guardar envía el conjunto completo solo de los roles que cambiaron. Un rol rechazado conserva lo marcado mientras los demás se guardan. Sin `identity.role.manage`, la matriz es de solo lectura. |
| `core/http/api-error.spec.ts`   | El motivo de un `ProblemDetail` de ms-identidad llega a la pantalla.                                                                                                                              |

## Pendiente fuera de esta issue

- **RBAC-06:**
  - La matriz aprobada se arma desde la exportación.
  - Conviene decidir si BILLING_CLERK necesita `patients.patient.read`: sin ese permiso puede abrir **Emitir factura**, pero no buscar al paciente (403). El problema ya existía antes.
- **LOG-02:** asignar y revocar no dejan todavía evento en la bitácora. La revocación borra la asignación, así que hasta LOG-02 su único rastro es el registro de PR-03.
- **HARD-02:** cerrar sesión al quitar acceso lo respeta ms-identidad. Los demás servicios aceptan el token hasta que vence (como máximo, 1 h).
- **IAM-06:** las pantallas de cuentas (alta, edición, baja, desbloqueo) pueden enlazar a la hoja de roles de la cuenta.
