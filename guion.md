# Guion de exposición — MedicalSys Frontend (Identidad, Agenda, Auditoría)

Guion pensado para ~8-10 minutos de exposición, una diapositiva por bloque (coincide con
`prompt.md`). Cada bloque trae: qué decir, el punto clave que no debe faltar, y una
posible pregunta que te pueden hacer.

---

## 1. Portada (30 seg)

**Decir:** "Voy a explicar cómo se construyó el frontend de tres módulos de MedicalSys:
Identidad, Agenda y Auditoría, dentro de una plataforma más grande de microservicios.
No es un proyecto de una sola persona: el frontend completo lo hicimos entre cinco, cada
uno dueño de un área que refleja un microservicio del backend."

**Punto clave:** dejar claro desde el inicio que esto es un frontend sobre una arquitectura
de microservicios real, no una app aislada.

---

## 2. El problema: un frontend sobre microservicios (1 min)

**Decir:** "Todo el frontend es una sola aplicación Angular, pero nunca habla directo con
un microservicio. Todo pasa por un API Gateway, bajo el prefijo `/api/v1`. Por ejemplo,
Identidad vive en `/api/v1/identity`, Agenda en `/api/v1/scheduling`, y Auditoría —ya van a
ver por qué lo remarco— en `/api/v1/audit`, que hoy todavía no existe publicado."

**Punto clave:** la regla dura del equipo: "prohibido llamar directo a un microservicio o a
rutas internas". Esto explica muchas decisiones posteriores (por qué no se hackea un
bypass cuando algo falla, por ejemplo).

**Posible pregunta:** "¿Por qué no consumir cada microservicio directo, sería más rápido?"
→ Respuesta: el gateway centraliza auth, correlación de requests y es el único punto de
verdad de qué está realmente publicado; consumir directo rompería el aislamiento y el
control de acceso por tenant.

---

## 3. Reparto de trabajo y mi rol (45 seg)

**Decir:** "La propiedad técnica del frontend siguió la misma distribución que el backend:
cada persona es dueña de un slice, aunque todos revisamos y ayudamos donde hace falta. Mi
parte fue Login, sesión, identidad, agenda y disponibilidad. Además tuve un rol
transversal como responsable de movimiento: definir qué transiciones tienen sentido
funcional y respetar `prefers-reduced-motion` para quien lo necesite."

**Punto clave:** dejar claro cuál es tu contribución específica, sin restarle mérito al
equipo.

---

## 4. Identidad: iniciar sesión y sostener la sesión (1.5 min)

**Decir:** "Identidad no es solo la pantalla de login, es lo que sostiene toda la sesión
de la app. Ahí definí tres reglas que se respetan en todo el frontend: primero, el token
nunca se arma a mano en cada pantalla, hay un interceptor HTTP que lo agrega
automáticamente a cada request. Segundo, el frontend nunca decodifica el JWT para decidir
seguridad — puede ocultar un botón por comodidad, pero quien autoriza de verdad siempre es
el gateway y el backend. Y tercero, cosas como el `organizationId` o el rol del usuario
nunca vienen de un formulario que el usuario podría manipular: siempre vienen de la
sesión."

**Punto clave (el más importante de esta diapositiva):** "un permiso de interfaz no es
seguridad". Es una idea que suele impresionar en una exposición técnica porque muestra
madurez de diseño, no solo funcionalidad.

**Posible pregunta:** "¿Cómo saben qué puede ver cada rol?" → Se leyeron las anotaciones
`@RequiresRole` directamente del código del backend, no de la documentación, para no
ofrecer en pantalla algo que el backend terminaría rechazando con un 403.

---

## 5. Agenda: la vista semanal como tablero de tiempo (1.5 min)

**Decir:** "La agenda es un tablero semanal por profesional. La regla de diseño es simple:
un minuto es un pixel de alto, así que la altura de cada bloque de cita es literalmente su
duración. Cuando dos citas se solapan en el tiempo, se reparten en carriles dentro de la
misma columna, para que nunca se tapen entre sí."

**Anécdota (dale vida, es lo más 'humano' de la charla):** "El ancho de columna inicial
era de 200 píxeles y no alcanzaba: un nombre boliviano completo, con dos nombres y dos
apellidos, se cortaba en la cabecera y también dentro de cada cita. Tuve que medir cuánto
ocupa realmente un nombre así a 13 píxeles de cuerpo, y terminamos en 248 píxeles. Es un
ejemplo de que hay que diseñar con datos reales del contexto, no con nombres cortos de
ejemplo."

**Punto clave:** al hacer clic en un hueco libre de la agenda, la hora se redondea al
cuarto más cercano — pequeño detalle que hace que crear una cita sea rápido sin perder
precisión.

---

## 6. Auditoría: el módulo que se construyó antes que su backend (1.5 min)

**Decir (este es el "reto" central de la charla, tómate tu tiempo):** "Esta es la parte
más interesante de auditoría. El prefijo `/api/v1/audit` está acordado en el contrato
entre equipos, pero el microservicio de auditoría —`ms-auditoria`— todavía no existe en la
plataforma. Hoy, esa ruta responde 404."

**Decir:** "Aun así, el módulo se construyó completo: modelos, filtros, estados de carga y
error, exportación... todo programado contra el contrato acordado, no contra un backend
real. Pero tomamos una decisión deliberada: esa pantalla no aparece en el menú lateral
hasta que el servicio exista de verdad. No queríamos que alguien llegara por accidente a
una pantalla que solo puede fallar."

**Punto clave / frase para cerrar el bloque:** "En microservicios, a veces el frontend
adelanta al backend. El trabajo serio no es solo construir la pantalla, es decidir cuándo
esa pantalla se le muestra al usuario."

**Posible pregunta:** "¿Cómo probaron algo que no tiene backend?" → Contra el contrato
documentado en `docs/contracts`, con mocks/errores simulados, validando que la interfaz
maneje bien tanto el caso feliz como el 404 real que hoy devuelve.

---

## 7. Auditoría: qué puede hacer un auditor en la pantalla (1 min)

**Decir:** "Cuando el servicio exista, esto es lo que va a poder hacer un auditor: filtrar
eventos por fecha, categoría, severidad, resultado, servicio de origen, usuario, paciente
o por el correlation ID exacto de un caso. Cada evento se puede expandir para ver el
detalle completo. Hay un panel de integridad del log, un resumen agregado, y exportación a
CSV con el nombre del archivo generado automáticamente con la fecha."

**Punto clave:** el correlation ID es copiable con un clic en toda la aplicación — conecta
directamente con el siguiente bloque, sobre el contrato de errores.

---

## 8. Un sistema de diseño propio, no controles nativos (1.5 min)

**Decir:** "Otra decisión importante fue no usar controles nativos del navegador para
formularios. La razón es simple: un `<select>` se ve distinto en macOS, Windows, Chrome,
Safari y Android. Para un producto que se usa en distintos centros médicos con distintos
equipos, eso significa que dos personas del mismo centro ven la aplicación distinta."

**Decir:** "Construimos un combobox accesible propio, con navegación por teclado completa
y búsqueda por escritura; un campo de fecha que se escribe directo en formato día/mes/año,
pensado porque la fecha más tecleada en un sistema médico es una fecha de nacimiento; y un
tooltip propio, porque el atributo `title` nativo tarda casi un segundo en aparecer y
nunca se muestra con el foco del teclado, lo cual es un problema real de accesibilidad."

**Punto clave:** sí se conservó el `<dialog>` nativo para modales, porque no dibuja nada
visible pero regala gratis trampa de foco y cierre con Escape — mostrar que no se
reinventa todo por dogma, solo lo que realmente lo necesitaba.

---

## 9. Contrato con el backend: errores y estados, siempre (1 min)

**Decir:** "Toda la aplicación respeta el mismo contrato de error: nunca se le muestra al
usuario un stack trace o un JSON crudo. Cada estado HTTP tiene un comportamiento definido:
un 401 limpia la sesión y vuelve al login, un 403 muestra acceso denegado sin entrar en
bucle de redirecciones, un 409 muestra el conflicto —por ejemplo una cita que se solapa—,
y un error de servidor muestra un mensaje estable con el correlation ID copiable."

**Decir:** "Y cada pantalla con datos implementa los mismos cinco estados: carga, vacío la
primera vez, vacío por un filtro, error, y degradación parcial — si una sección falla, el
resto de la pantalla sigue funcionando."

**Punto clave:** esto no es solo estética, es lo que permite que fallos reales del backend
(como los del siguiente bloque) no tumben la experiencia completa.

---

## 10. Retos técnicos reales del entorno (1.5 min)

**Decir:** "Trabajar contra microservicios en desarrollo activo, y no contra un mock
perfecto, trajo problemas reales que el frontend tuvo que absorber."

**Reto 1:** "El microservicio de pacientes no compilaba en la rama de desarrollo del
backend por un método faltante y una ruta duplicada. El frontend tuvo que degradar con
elegancia: mostrar un identificador abreviado en vez de romperse."

**Reto 2:** "El listado de órdenes de estudio devolvía error 500 de forma intermitente:
una clave de cifrado temporal cambiaba cada vez que se reiniciaba el microservicio de
historial clínico, y una sola fila antigua sin poder descifrarse tumbaba el listado
completo. El detalle individual de cada orden sí funcionaba bien."

**Reto 3:** "Y ya lo mencioné: auditoría, cuyo backend todavía no existe."

**Cierre del bloque:** "Ninguna de estas limitaciones depende del frontend, pero se ven al
usarlo. Diseñar para ellas fue tan parte del trabajo como construir la pantalla."

---

## 11. Cierre: qué me llevo de este proyecto (45 seg)

**Decir:** "Me llevo cuatro ideas concretas: diseñar contra un contrato acordado, no
contra un backend terminado. Que un permiso de interfaz no es seguridad, el backend
siempre vuelve a decidir. Que un layout basado en tiempo real obliga a medir datos reales
antes de fijar tamaños, no placeholders. Y que ocultar algo a propósito, como el menú de
auditoría, también es una decisión de diseño, no solo trabajo sin terminar."

**Cerrar con:** "Gracias. Quedo abierto a preguntas."

---

## Notas generales para la exposición

- **Tiempo total estimado:** 8-10 minutos de habla + preguntas. Si te sobra tiempo, extiende
  el bloque 6 (auditoría) y el bloque 10 (retos): son los que más interés generan.
- **Evita leer los bullets tal cual** aparecen en la diapositiva; la diapositiva es apoyo
  visual, el guion de arriba es lo que efectivamente dices.
- **Si hay una demo en vivo disponible**, el mejor momento para intercalarla es justo
  después del bloque 5 (Agenda) o del bloque 7 (Auditoría), mostrando la pantalla real.
- **Preguntas frecuentes a preparar además de las ya anotadas:**
  - "¿Qué pasa si el gateway cae?" → cada request lleva `X-Correlation-Id`; el error se
    muestra con mensaje estable y ese ID, sin redirecciones en bucle.
  - "¿Por qué Angular y no otro framework?" → decisión de equipo previa al alcance de esta
    charla; el foco aquí es el diseño de las vistas, no la elección de stack.
