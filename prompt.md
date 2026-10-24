# Prompts para generar las imágenes (MedicalSys Frontend)

Cada bloque de abajo es un prompt independiente para generar **una sola imagen**.
Úsalos uno por uno en tu herramienta de diseño/IA de presentaciones (Gamma, Beautiful.ai,
Canva Magic Design, Plus AI, o pídeselos a un LLM para que genere el HTML/slide directamente).

Enfoque general: esta presentación explica **qué hace cada vista para el usuario**
(funcionalidades, flujos, información que ve y decisiones que puede tomar), no cómo
está programada por dentro. Evita jerga de implementación (interceptores, componentes,
píxeles, arquitectura interna) salvo que se indique explícitamente en el prompt.

**Paleta de marca** (tomada de la identidad visual MSYS — ver `tmp/image.png`):

- Verde Jade `#1C7F60` — color principal, usado en títulos, acentos, formas geométricas
  y fondos de bloque destacados.
- Terracota `#E57833` — color secundario/complementario, usado con moderación para
  resaltar el segundo nivel de jerarquía (subtítulos de bloque, chips de advertencia,
  detalles), nunca como color dominante de la imagen.
- Fondo claro `#F7F8FA` (o blanco), con texto principal en negro/gris muy oscuro para
  máximo contraste.

**Dirección de arte común a todas las imágenes** (repítela o inclúyela como "estilo base"
si tu herramienta lo permite):

> Estilo visual: minimalista, moderno, tipo dashboard de producto sanitario. Fondo claro
> (blanco o gris muy claro #F7F8FA). Paleta de dos acentos: verde jade (#1C7F60) como
> color principal y terracota (#E57833) como color secundario, usados con moderación
> (formas geométricas simples, franjas, chips o resaltados — nunca como fondo completo
> de la imagen). Tipografía sans-serif geométrica y en negrita para títulos (estilo
> Manrope/Inter/Poppins bold, como en el logo "MSYS"), mucho espacio en blanco, sin
> degradados llamativos ni iconografía genérica de stock, sin emojis. Jerarquía
> tipográfica clara: un título grande por imagen, subtítulo corto, cuerpo en bullets
> cortos (máximo 4-5 líneas de texto por imagen). Si se pide un diagrama o mockup, que
> sea plano (flat), con líneas finas y esquinas redondeadas suaves, coherente con un
> sistema de diseño de producto real, no una ilustración decorativa. Como recurso
> gráfico de fondo opcional se puede usar un círculo o cuarto de círculo grande en verde
> jade o terracota en una esquina, y una textura sutil de líneas diagonales finas
> (como en la lámina de marca), siempre sin tapar el contenido.

---

## imagen 1 — Portada

```
Genera una imagen de portada, minimalista y moderna, para una exposición sobre las
vistas de un sistema médico multi-tenant: Identidad (login), Agenda y Auditoría.

Contenido:
- Título principal: "MedicalSys — Identidad, Agenda y Auditoría"
- Subtítulo: "Un recorrido por las tres vistas y qué le resuelven al usuario"
- Autor: Álvaro (responsable de las vistas de Identidad, Agenda y disponibilidad)
- Pie de página discreto: "Sistema de gestión médica multi-centro"

Tono: profesional, claro, orientado a producto (no técnico). Nada de imágenes de stock
de "doctores sonriendo"; si quieres un elemento gráfico, usa una forma abstracta
geométrica simple (por ejemplo tres círculos conectados por líneas finas, representando
las tres vistas de la exposición).

Estilo: fondo claro, acentos verde jade (#1C7F60) como color principal y terracota
(#E57833) como detalle secundario (por ejemplo un cuarto de círculo verde jade en una
esquina y un pequeño círculo terracota en la esquina opuesta, como en la lámina de marca),
tipografía sans-serif geométrica en negrita, mucho espacio en blanco, layout centrado o
alineado a la izquierda tipo portada de dashboard.
```

[Espacio para captura de pantalla — logo/portada de la app, si aplica]

---

## imagen 2 — Qué es MedicalSys: una sola app para varios centros

```
Genera una imagen minimalista y moderna que presente, en tono claro y didáctico, qué
resuelve la aplicación en general antes de entrar en cada vista.

Contenido a comunicar (reescríbelo en bullets cortos, no lo copies literal):
- Es un sistema de gestión para centros médicos: cada organización (clínica/consultorio)
  usa la misma app con sus propios datos, separados de los demás centros.
- Cubre las áreas típicas de la operación de un centro médico: historial clínico,
  facturación, agenda de citas, profesionales, pacientes, marketing, control de accesos
  (identidad) y auditoría de lo que pasa en el sistema.
- Tres personas usan la app con permisos distintos: Administración, Profesional de
  salud y Recepción — cada una ve solo las opciones que le corresponden.
- Esta exposición se centra en tres vistas concretas: Identidad (inicio de sesión),
  Agenda (citas semanales) y Auditoría (bitácora de actividad).

Incluye un esquema simple con tres "tarjetas de rol" (Administración, Profesional de
salud, Recepción) y, debajo, tres iconos o etiquetas para las vistas de la charla:
Identidad, Agenda, Auditoría.

Estilo: minimalista, moderno, fondo claro, tarjetas y esquema en verde jade (#1C7F60),
las tres etiquetas de vistas resaltadas en terracota (#E57833) para marcar que son el
foco de la presentación, líneas finas y esquinas redondeadas, sin sombras pesadas.
```

---

## imagen 3 — Reparto de trabajo y mi rol

```
Genera una imagen minimalista y moderna sobre organización de equipo en un proyecto
de software, en tono personal pero profesional (primera persona).

Contenido:
- Frase de contexto: "Cada integrante fue responsable de un conjunto de vistas del
  sistema; eso no impide revisar o ayudar en otras partes."
- Tabla o lista de 5 integrantes con su área principal, resaltando la mía:
  · Álvaro — Login, sesión, agenda y disponibilidad (resaltado, es "yo")
  · Franco — Historial clínico, atención, tenencia y facturación (+ Tech Lead / Interaction Design)
  · Nicole — Pacientes, documentos (+ Visual Design)
  · Jhon — Profesionales, navegación general del sistema
  · Juanjo — Catálogos del sistema
- Mi rol transversal adicional: "Motion Designer" — defino cómo se mueven y aparecen
  los elementos en pantalla, cuidando que sea agradable y no invasivo.

Estilo: minimalista, moderno, una tabla o lista limpia de 2 columnas, mi fila/tarjeta
destacada con fondo verde jade (#1C7F60) y texto blanco, el resto de filas en gris
neutro con un pequeño detalle terracota (#E57833) en los íconos de rol, sin fotos de
personas.
```

---

## imagen 4 — Identidad: iniciar sesión

```
Genera una imagen minimalista y moderna centrada en la vista de inicio de sesión de un
sistema médico, explicando qué le ofrece al usuario (no cómo está programada).

Contenido a comunicar:
- Qué hace la vista: es la puerta de entrada al sistema; el usuario ingresa sus
  credenciales y accede solo a las opciones que corresponden a su rol (Administración,
  Profesional de salud o Recepción).
- Qué ve el usuario según su rol: un menú y unas acciones distintas — por ejemplo,
  Recepción puede agendar citas pero no ver reportes financieros; Administración sí.
- Manejo de errores claro y sin tecnicismos: si la contraseña es incorrecta o la sesión
  vence, la app lo explica en lenguaje simple y lleva de vuelta al login, sin dejar al
  usuario en una pantalla rota o confusa.
- La sesión se mantiene mientras el usuario navega entre vistas, sin pedir la contraseña
  de nuevo en cada pantalla.

Incluye un esquema visual simple: [Pantalla de inicio de sesión] -> [Selección de rol] ->
[Menú de opciones según el rol].

Estilo: minimalista, moderno, fondo claro, esquema en verde jade (#1C7F60) con el paso
de "según el rol" resaltado en terracota (#E57833), iconografía lineal simple (candado,
usuario), sin capturas de pantalla reales.
```

[Espacio para captura de pantalla — pantalla de login real]

[Espacio para captura de pantalla — menú principal cambiando según el rol]

---

## imagen 5 — Agenda: la vista semanal de citas

```
Genera una imagen minimalista y moderna que explique, desde la perspectiva del usuario,
qué permite hacer la vista de Agenda de un sistema médico.

Contenido a comunicar:
- La agenda muestra la semana completa organizada por profesional: cada columna es un
  profesional y cada bloque de color es una cita, con un alto proporcional a su duración
  para que de un vistazo se note qué tan larga es cada consulta.
- Cuando dos citas coinciden en el mismo horario, se muestran una al lado de la otra
  dentro de la misma columna, para que nunca se tapen ni se pierda información.
- Crear una cita es tan simple como hacer clic en un horario libre: el sistema propone
  automáticamente una hora redondeada (en punto o cuarto de hora), lista para ajustar.
- Un mismo panel sirve tanto para ver el detalle de una cita existente como para crear
  una nueva, así el usuario no tiene que aprender dos pantallas distintas.
- Pensada para nombres reales de pacientes y profesionales (nombres y apellidos
  completos), sin que el texto se corte o se desborde.

Incluye un mockup simple y plano de una grilla semanal con 3-4 columnas de profesionales
y bloques de distintas alturas representando citas, uno de ellos partido en dos citas
lado a lado por coincidir en el horario.

Estilo: minimalista, moderno, fondo claro, encabezados de columna y líneas de grilla en
verde jade (#1C7F60), bloques de citas en verde jade con el par de citas simultáneas
resaltado en terracota (#E57833) para llamar la atención sobre ese caso, tipografía
legible, sin datos de pacientes reales (usa "Paciente A", "Paciente B").
```

[Espacio para captura de pantalla — vista semanal de la agenda real]

[Espacio para captura de pantalla — panel de crear/editar cita]

---

## imagen 6 — Auditoría: una bitácora de todo lo que pasa en el sistema

```
Genera una imagen minimalista y moderna que presente, en tono claro, para qué sirve la
vista de Auditoría dentro de un sistema médico.

Contenido a comunicar:
- La auditoría es la "caja negra" del sistema: registra qué acción hizo cada usuario,
  cuándo, sobre qué información y si tuvo éxito o falló.
- Sirve para responder preguntas de control y seguridad: quién modificó el historial de
  un paciente, quién intentó entrar sin permiso, o qué pasó justo antes de un error.
- Está pensada para el personal de administración o soporte del centro médico, no para
  el uso diario de recepción o del profesional de salud.
- Es una vista de solo lectura: permite buscar y revisar eventos pasados, pero no
  modificar ni borrar el historial, para que la bitácora siga siendo confiable.

Elemento visual sugerido: un ícono simple de "lista/registro" o "reloj de historial"
como imagen central, con pequeños eventos ordenados en una línea de tiempo debajo.

Estilo: minimalista, moderno, fondo claro, estructura principal en verde jade (#1C7F60),
con algún evento o etiqueta puntual resaltado en terracota (#E57833) para dar dinamismo,
sin iconos de alarma exagerados.
```

[Espacio para captura de pantalla — vista general de la bitácora de auditoría]

---

## imagen 7 — Auditoría: qué puede hacer un auditor en la pantalla

```
Genera una imagen minimalista y moderna que muestre las funcionalidades concretas de la
pantalla de bitácora de auditoría de un sistema médico, desde el punto de vista de uso.

Contenido a comunicar:
- Filtros de búsqueda para encontrar justo lo que se necesita: por fecha y hora,
  categoría del evento, si tuvo éxito o falló, nivel de gravedad, usuario responsable,
  paciente involucrado o una palabra clave libre.
- Cada evento se puede abrir para ver su detalle completo, y solo uno a la vez, para no
  perder de vista el resto de la lista mientras se revisa un caso.
- Un resumen general muestra cuántos eventos hubo, de qué tipo y en qué rango de fechas,
  antes de entrar al detalle de cada uno.
- Toda la información filtrada se puede exportar a un archivo para compartir con
  auditoría externa o guardar como respaldo.
- Cada evento tiene un identificador único que se puede copiar con un clic, útil para
  que soporte técnico ubique el mismo caso si hace falta investigarlo más a fondo.

Incluye un mockup simple: una barra de filtros arriba, una tabla de eventos con columnas
(fecha, categoría, gravedad, resultado, acción) y un botón "Exportar" a la derecha.

Estilo: minimalista, moderno, fondo claro, barra de filtros y encabezados de tabla en
verde jade (#1C7F60), el botón "Exportar" y los chips de gravedad/resultado en terracota
(#E57833) como acento secundario, mockup de líneas finas tipo wireframe, tipografía
legible, sin datos reales de pacientes.
```

[Espacio para captura de pantalla — pantalla de auditoría con filtros y tabla]

---

## imagen 8 — Controles pensados para que todos vean lo mismo

```
Genera una imagen minimalista y moderna sobre la decisión de usar controles de
formulario propios (selects, campos de fecha, etc.) en lugar de los del navegador,
explicando el beneficio para el usuario.

Contenido a comunicar:
- Motivo: los controles del navegador (menús desplegables, selector de fecha) se ven y
  se comportan distinto según el dispositivo o el navegador; dos personas del mismo
  centro médico podían ver la app de forma distinta.
- Con los controles propios, la app se ve y funciona igual para todos, sin importar el
  navegador o el sistema operativo.
- El selector de fecha permite escribir la fecha directamente o elegirla en un
  calendario, con una forma rápida de saltar entre años — pensado para cuando se necesita
  ingresar una fecha de nacimiento lejana.
- Los menús desplegables permiten escribir para buscar entre muchas opciones (por
  ejemplo, elegir un profesional o una categoría) en lugar de desplazarse por una lista
  larga.
- Las ventanas emergentes (para confirmar o editar algo) siempre atrapan la atención en
  lo importante y se pueden cerrar con la tecla Escape.

Incluye 2-3 mockups pequeños en miniatura, lado a lado, mostrando el control genérico del
navegador vs. el control propio de la app (por ejemplo un menú desplegable simple vs. el
mismo menú con buscador y resaltado de opción).

Estilo: minimalista, moderno, fondo claro, el control "antes" (genérico) en gris neutro y
el control "después" (propio) resaltado en verde jade (#1C7F60), con la etiqueta
"después" en terracota (#E57833), comparación clara "antes vs. después" con etiquetas
pequeñas, sin sombras pesadas.
```

[Espacio para captura de pantalla — menú desplegable propio con búsqueda]

[Espacio para captura de pantalla — selector de fecha propio]

---

## imagen 9 — Cuando algo falla, el usuario siempre sabe qué pasó

```
Genera una imagen minimalista y moderna sobre cómo la aplicación comunica errores y
estados de carga al usuario, en tono claro y orientado a experiencia de uso.

Contenido a comunicar:
- Los mensajes de error siempre se explican en lenguaje simple, nunca se muestra al
  usuario un mensaje técnico incomprensible.
- Cada tipo de problema tiene una respuesta clara: si la sesión venció, se pide iniciar
  sesión de nuevo; si no se tiene permiso para algo, se avisa sin dejar a la persona
  dando vueltas; si hay un conflicto (por ejemplo, dos citas que se cruzan), se explica
  cuál es el conflicto; si el sistema falla temporalmente, se muestra un aviso estable
  con un código que soporte técnico puede usar para investigar.
- Mientras se cargan los datos, la pantalla muestra un aviso de carga con la forma del
  contenido que está por aparecer, en vez de dejar la pantalla en blanco.
- Si una parte de la pantalla no puede cargar, el resto sigue funcionando con
  normalidad, en lugar de que toda la vista se rompa.

Incluye una fila visual de 5 "estados" representados como chips o tarjetas pequeñas:
Cargando · Sin datos · Con datos · Error · Parcialmente disponible.

Estilo: minimalista, moderno, fondo claro, chips "Cargando", "Sin datos" y "Con datos" en
verde jade (#1C7F60), chips "Error" y "Parcialmente disponible" en terracota (#E57833)
para marcar la diferencia de estado, esquinas redondeadas, tipografía legible, sin
iconos de alarma exagerados.
```

[Espacio para captura de pantalla — estado de carga de una pantalla real]

[Espacio para captura de pantalla — mensaje de error mostrado al usuario]

---

## imagen 10 — Retos reales al construir sobre un sistema en desarrollo

```
Genera una imagen minimalista y moderna que liste, en tono honesto, situaciones reales
que se presentaron mientras se probaban las vistas, y cómo la app respondió ante ellas
para el usuario final.

Contenido a comunicar (tres situaciones, una por bloque/tarjeta):
1. En algunos momentos, la información de un paciente no pudo cargarse por completo;
   la app mostró un identificador reducido en su lugar en vez de dejar la pantalla vacía
   o rota.
2. En ciertos casos, un listado de estudios médicos no pudo mostrarse por completo por un
   problema temporal del sistema; el detalle individual de cada estudio sí seguía
   funcionando con normalidad.
3. La vista de Auditoría todavía no puede conectarse con información real porque esa
   parte del sistema sigue en construcción; por eso hoy no aparece en el menú principal,
   para que nadie llegue a una pantalla que no puede funcionar todavía.

Cierre de la imagen: "Estas situaciones no dependen de lo que ve el usuario a diario,
pero se notan si no se manejan bien — por eso cada pantalla está pensada para seguir
siendo clara incluso cuando algo no sale como se espera."

Estilo: minimalista, moderno, fondo claro, tres tarjetas iguales en fila o columna con
borde superior en terracota (#E57833) como marca de "situación real", títulos de cada
tarjeta en verde jade (#1C7F60), texto de cuerpo corto y directo, sin iconos de error
genéricos.
```

[Espacio para captura de pantalla — ejemplo real de una pantalla que sigue funcionando parcialmente]

---

## imagen 11 — Cierre: qué le aporta esto al usuario

```
Genera una imagen de cierre minimalista y moderna, en primera persona, para el final de
una exposición sobre las vistas de Identidad, Agenda y Auditoría.

Contenido:
- Título: "Qué le aportan al usuario las vistas de Identidad, Agenda y Auditoría"
- 3-4 ideas concretas, en bullets cortos, por ejemplo:
  · Cada persona ve solo lo que le corresponde a su rol, sin pantallas confusas de más.
  · La agenda deja ver de un vistazo la semana completa de un profesional y evita citas
    encimadas sin que nadie se dé cuenta.
  · La auditoría da tranquilidad: siempre hay un registro claro de qué pasó y quién lo
    hizo.
  · Ocultar a propósito una función todavía no lista (como la auditoría por ahora) es
    también cuidar la experiencia del usuario, no solo "faltó terminarla".
- Cierre: agradecimiento breve y espacio para preguntas ("Preguntas").

Estilo: minimalista, moderno, fondo claro, título en verde jade (#1C7F60), un cuarto de
círculo verde jade y un pequeño círculo terracota (#E57833) como remate gráfico en las
esquinas (igual que en la lámina de marca), mucho espacio en blanco, tipografía grande
para el título, sin imágenes decorativas.
```
