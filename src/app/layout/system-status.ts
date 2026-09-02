import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/config/api-url';
import { formatRelative } from '../core/format/format';
import { Icon } from '../core/ui/icon';

interface Probe {
  readonly id: string;
  readonly name: string;
  readonly up: boolean;
  readonly latencyMs: number;
}

const SERVICES = [
  { id: 'historial', name: 'Historial clínico', path: '/medical-records/ping' },
  { id: 'tenencia', name: 'Organización', path: '/tenancy/ping' },
  { id: 'facturacion', name: 'Facturación', path: '/billing/ping' },
  { id: 'pacientes', name: 'Pacientes', path: '/patients/ping' },
] as const;

/**
 * Estado de los servicios de los que depende esta interfaz.
 *
 * No es un panel técnico: responde a la única pregunta operativa que se hace el
 * personal de la clínica cuando algo tarda — «¿está caído el sistema o es mi
 * conexión?». Por eso vive en la cabecera y no en una pantalla propia.
 */
@Component({
  selector: 'medsys-system-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="popover-anchor">
      <button
        type="button"
        class="btn btn-ghost btn-sm status-trigger"
        [attr.aria-label]="'Estado del sistema: ' + summary()"
        [attr.aria-expanded]="expanded()"
        [title]="summary()"
        (click)="toggle()"
      >
        <span class="status-dot" [class]="'status-dot status-' + tone()" aria-hidden="true"></span>
        <medsys-icon name="activity" [size]="15" />
      </button>

      @if (expanded()) {
        <div class="popover popover-panel" style="width: 280px">
          <div style="padding: var(--s-3)" class="stack gap-3">
            <div class="stack gap-1">
              <span class="t-card">Estado del sistema</span>
              <span class="t-sec">{{ summary() }}.</span>
            </div>
            <ul class="stack gap-2">
              @for (probe of probes(); track probe.id) {
                <li class="row gap-2">
                  <span class="grow t-sec" style="color: var(--text-body)">{{ probe.name }}</span>
                  @if (probe.up) {
                    <span class="t-micro t-num">{{ probe.latencyMs }} ms</span>
                    <span class="status-dot status-ok" aria-hidden="true"></span>
                  } @else {
                    <span class="chip chip-err">Sin respuesta</span>
                  }
                </li>
              }
            </ul>
            @if (checkedAt(); as at) {
              <span class="t-micro">Última comprobación {{ relative(at) }}.</span>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SystemStatus {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  protected readonly probes = signal<readonly Probe[]>([]);
  protected readonly checkedAt = signal<string | null>(null);
  protected readonly expanded = signal(false);

  protected readonly tone = computed(() => {
    const probes = this.probes();
    if (probes.length === 0) return 'neutral';
    const down = probes.filter((probe) => !probe.up).length;
    if (down === 0) return 'ok';
    return down === probes.length ? 'err' : 'warn';
  });

  protected readonly summary = computed(() => {
    const probes = this.probes();
    if (probes.length === 0) return 'Comprobando el estado del sistema';
    const down = probes.filter((probe) => !probe.up).length;
    if (down === 0) return 'Todos los servicios responden';
    if (down === probes.length) return 'Ningún servicio responde';
    return `${down} de ${probes.length} servicios no responden`;
  });

  constructor() {
    void this.probe();
    setInterval(() => void this.probe(), 60_000);
    // Un clic fuera cierra el panel sin necesitar una capa que bloquee la página.
    document.addEventListener('click', (event) => {
      if (this.expanded() && !(event.target as Element)?.closest('medsys-system-status')) {
        this.expanded.set(false);
      }
    });
  }

  protected toggle(): void {
    this.expanded.update((open) => !open);
  }

  protected relative(value: string): string {
    return formatRelative(value);
  }

  private async probe(): Promise<void> {
    const results = await Promise.all(
      SERVICES.map(async (service): Promise<Probe> => {
        const startedAt = performance.now();
        try {
          await firstValueFrom(this.http.get(`${this.baseUrl}${service.path}`));
          return {
            id: service.id,
            name: service.name,
            up: true,
            latencyMs: Math.round(performance.now() - startedAt),
          };
        } catch {
          return {
            id: service.id,
            name: service.name,
            up: false,
            latencyMs: Math.round(performance.now() - startedAt),
          };
        }
      }),
    );
    this.probes.set(results);
    this.checkedAt.set(new Date().toISOString());
  }
}
