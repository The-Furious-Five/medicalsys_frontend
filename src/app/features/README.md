# Funcionalidades

Esta carpeta se organiza por áreas funcionales, no por tipo técnico. Cada nueva funcionalidad debe
agrupar sus páginas, componentes, modelos, acceso HTTP, rutas y pruebas relacionados.

Áreas del flujo MVP:

- `auth` (acceso)
- `home` (panel de inicio)
- `patients`
- `professionals`
- `scheduling` (agenda)
- `medical-records` (historial clínico)
- `billing` (facturación)
- `marketing`
- `tenancy` (organización)
- `catalogs` (referencias clínicas)
- `audit` (bitácora; a la espera de `ms-auditoria`)
- `settings`

No se deben crear carpetas globales como `all-components` o `all-services`. Un elemento pasa a
`shared` únicamente cuando es realmente reutilizable por más de una funcionalidad.
