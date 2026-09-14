import { HttpResourceRef } from '@angular/common/http';
import { Signal, computed } from '@angular/core';

/**
 * Vista segura de un recurso HTTP.
 *
 * `Resource.value()` **lanza** cuando el recurso está en estado de error. Si una
 * plantilla lo lee sin haber comprobado antes `error()` —por ejemplo para pintar
 * un contador en la cabecera de la tarjeta— el render de esa vista se rompe a
 * medias y la pantalla se queda congelada en su último estado, normalmente el
 * esqueleto de carga y sin ningún mensaje. El usuario ve un panel que gira para
 * siempre y no puede saber que el servicio falló.
 *
 * Aquí `value()` devuelve `undefined` en vez de lanzar. El estado de error sigue
 * estando en `error()`, que es donde cada vista lo consulta para explicarlo.
 */
export interface DataResource<T> {
  /** Valor cargado, o `undefined` mientras carga, si falló o si está inactivo. */
  readonly value: Signal<T | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  /** Cierto solo cuando hay un valor real que mostrar. */
  readonly hasValue: Signal<boolean>;
  reload(): void;
}

export function dataResource<T>(reference: HttpResourceRef<T | undefined>): DataResource<T> {
  return {
    value: computed(() => (reference.hasValue() ? reference.value() : undefined)),
    isLoading: reference.isLoading,
    error: reference.error,
    hasValue: computed(() => reference.hasValue()),
    reload: () => reference.reload(),
  };
}
