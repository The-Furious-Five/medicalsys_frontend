import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../../core/ui/icon';

/**
 * Leyenda de demostración.
 *
 * Aparece en la factura, en su listado y en el formulario de emisión, y no se
 * puede descartar. Una factura sin validez fiscal que no lo diga en todas
 * partes es un problema real, no un detalle de interfaz.
 */
@Component({
  selector: 'medsys-demo-caption',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (compact()) {
      <span class="demo-caption demo-caption-compact">
        <medsys-icon name="shield-alert" [size]="12" />
        Sin validez fiscal
      </span>
    } @else {
      <p class="demo-caption" role="note">
        <medsys-icon name="shield-alert" [size]="14" />
        <span>
          <strong>Documento de demostración — sin validez fiscal.</strong> Este comprobante no fue
          emitido ante el Servicio de Impuestos Nacionales y no sustituye a una factura.
        </span>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DemoCaption {
  readonly compact = input(false);
}
