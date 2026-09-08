import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from './empty-state';

@Component({
  selector: 'medsys-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <medsys-empty-state
      icon="search-x"
      heading="La página no existe"
      description="El enlace que seguiste no corresponde a ninguna sección de MSYS. Usa el menú lateral para continuar."
    />
  `,
})
export class NotFoundPage {}
