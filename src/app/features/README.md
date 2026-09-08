# Funcionalidades

Esta carpeta se organiza por áreas funcionales, no por tipo técnico. Cada nueva funcionalidad debe
agrupar sus páginas, componentes, modelos, acceso HTTP, rutas y pruebas relacionados.

Áreas previstas para el flujo MVP:

- `catalogs` (consulta de referencias clínicas; primer recorte funcional)
- `auth`
- `patients`
- `professionals`
- `scheduling`
- `medical-records`
- `documents`
- `billing`

No se deben crear carpetas globales como `all-components` o `all-services`. Un elemento pasa a
`shared` únicamente cuando es realmente reutilizable por más de una funcionalidad.
