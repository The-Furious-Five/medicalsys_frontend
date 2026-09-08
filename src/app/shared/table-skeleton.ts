import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Skeleton } from './skeleton';

/**
 * Esqueleto de tabla: mismas filas y mismo alto que la tabla real, para que la
 * llegada de los datos no provoque un salto de composición.
 */
@Component({
  selector: 'medsys-table-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    <table class="table" aria-hidden="true">
      <tbody>
        @for (row of rowList(); track row) {
          <tr>
            @for (column of columnList(); track column) {
              <td><medsys-skeleton [width]="column === 0 ? '60%' : '40%'" /></td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TableSkeleton {
  readonly rows = input(6);
  readonly columns = input(4);

  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly columnList = computed(() =>
    Array.from({ length: this.columns() }, (_, i) => i),
  );
}
