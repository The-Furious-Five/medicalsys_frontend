/**
 * Geometría del tablero.
 *
 * Una cita se dibuja como un bloque cuya posición vertical es su hora y cuya
 * altura es su duración: así la agenda se lee de un vistazo, sin comparar
 * números. Cuando dos citas comparten franja —la base solo lo permite si alguna
 * está cancelada o reprogramada— se reparten el ancho en carriles en vez de
 * taparse, porque una cita escondida es una cita que nadie atiende.
 */

export interface Placeable {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface Lane {
  readonly lane: number;
  readonly lanes: number;
}

/** Altura mínima de un bloque, en minutos equivalentes: por debajo de esto el
 *  texto no cabe y el bloque deja de ser legible. */
export const MIN_BLOCK_MINUTES = 24;

export function assignLanes(items: readonly Placeable[]): readonly Lane[] {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.startMinute - b.item.startMinute || a.item.endMinute - b.item.endMinute);

  const result: Lane[] = items.map(() => ({ lane: 0, lanes: 1 }));
  let cluster: number[] = [];
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const index of cluster) {
      result[index] = { lane: result[index].lane, lanes };
    }
    cluster = [];
    laneEnds = [];
  };

  for (const { item, index } of order) {
    // Un hueco sin solape cierra el grupo: a partir de aquí el ancho vuelve a
    // ser el de la columna entera.
    if (laneEnds.length > 0 && item.startMinute >= Math.max(...laneEnds)) {
      closeCluster();
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = Math.max(item.endMinute, item.startMinute + MIN_BLOCK_MINUTES);
    result[index] = { lane, lanes: 1 };
    cluster.push(index);
  }
  closeCluster();

  return result;
}

/** Rango de horas que el tablero debe mostrar: la jornada habitual, ampliada
 *  si alguna cita cae fuera. Nunca al revés: recortar escondería trabajo. */
export function hourWindow(
  items: readonly Placeable[],
  defaults: { readonly from: number; readonly to: number } = { from: 7, to: 20 },
): { readonly from: number; readonly to: number } {
  let from = defaults.from;
  let to = defaults.to;
  for (const item of items) {
    from = Math.min(from, Math.floor(item.startMinute / 60));
    to = Math.max(to, Math.ceil(item.endMinute / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, Math.max(to, from + 1)) };
}
