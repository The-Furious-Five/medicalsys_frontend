import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from './empty-state';

@Component({
  selector: 'medsys-access-denied-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <medsys-empty-state
      icon="shield-off"
      heading="Sin permiso para esta sección"
      description="Tu rol no incluye el acceso a esta parte de MSYS. Si necesitas entrar, solicítalo a la administración del centro."
    />
  `,
})
export class AccessDeniedPage {}
