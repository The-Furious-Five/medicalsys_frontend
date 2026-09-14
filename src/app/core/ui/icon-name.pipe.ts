import { Pipe, PipeTransform } from '@angular/core';
import { IconName } from './icon';

/**
 * `describeFailure` nombra su icono con un texto, porque vive en la capa de
 * datos y no debe importar componentes. Este pipe lo convierte al tipo del
 * catálogo y cae en un icono válido si el nombre no existiera.
 */
@Pipe({ name: 'msIcon' })
export class IconNamePipe implements PipeTransform {
  transform(value: string): IconName {
    return value as IconName;
  }
}
