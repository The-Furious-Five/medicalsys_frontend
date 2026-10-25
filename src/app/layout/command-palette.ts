import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../core/auth/auth-session';
import { can } from '../core/auth/permissions';
import { formatBob, formatDocument } from '../core/format/format';
import { DOCUMENT_TYPE_SHORT, label } from '../core/labels/labels';
import { Icon, IconName } from '../core/ui/icon';
import { PatientsService } from '../features/patients/patients.service';
import { TenancyService } from '../features/tenancy/tenancy.service';
import { Dialog } from '../shared/dialog';
import { visibleNav } from './nav';

interface Entry {
  readonly id: string;
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle: string | null;
  readonly group: string;
  readonly link: string;
}

/**
 * Buscador global.
 *
 * Su trabajo es llevar a una persona, una factura o una prestación en dos
 * pulsaciones, sin obligar a saber en qué sección vive cada cosa.
 */
@Component({
  selector: 'medsys-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Icon],
  templateUrl: './command-palette.html',
})
export class CommandPalette {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly patients = inject(PatientsService);
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected readonly term = signal('');
  protected readonly highlighted = signal(0);
  protected readonly searching = signal(false);
  private readonly patientEntries = signal<readonly Entry[]>([]);
  private debounce = 0;

  private readonly offerings = this.tenancy.offeringsResource(
    undefined,
    computed(() => this.open() && can.viewOfferings(this.session.permissions())),
  );

  /** Lista cruda, en el orden en que se descubren los resultados. */
  private readonly rawEntries = computed<readonly Entry[]>(() => {
    const normalized = this.term().trim().toLowerCase();
    const granted = this.session.permissions();
    const result: Entry[] = [...this.patientEntries()];

    if (normalized) {
      for (const offering of this.offerings.value()?.content ?? []) {
        if (result.length >= 14) break;
        if (`${offering.code} ${offering.name}`.toLowerCase().includes(normalized)) {
          result.push({
            id: `offering-${offering.id}`,
            icon: 'wallet',
            title: offering.name,
            subtitle: `${offering.code} · ${formatBob(offering.basePriceBob)}`,
            group: 'Prestaciones',
            link: '/prestaciones',
          });
        }
      }
    }

    for (const group of visibleNav(granted)) {
      for (const item of group.items) {
        if (!normalized || item.label.toLowerCase().includes(normalized)) {
          result.push({
            id: `nav-${item.link}`,
            icon: item.icon,
            title: item.label,
            subtitle: group.label,
            group: 'Ir a',
            link: item.link,
          });
        }
      }
    }

    if (can.issueInvoice(granted) && (!normalized || 'emitir factura'.includes(normalized))) {
      result.push({
        id: 'action-invoice',
        icon: 'receipt',
        title: 'Emitir una factura',
        subtitle: 'Facturación',
        group: 'Acciones',
        link: '/facturas/nueva',
      });
    }

    if (!normalized || 'configuracion configuración apariencia tema'.includes(normalized)) {
      result.push({
        id: 'nav-settings',
        icon: 'settings',
        title: 'Configuración',
        subtitle: 'Apariencia y cuenta',
        group: 'Ir a',
        link: '/configuracion',
      });
    }

    return result;
  });

  /**
   * Resultados agrupados, cada uno con su posición dentro de la lista.
   *
   * El índice se numera <b>después</b> de agrupar, no antes. Es la corrección de
   * un fallo real: la lista se pinta por grupos —«Pacientes», «Ir a»,
   * «Acciones»— mientras que el orden en que se descubren los resultados es
   * otro, así que las flechas saltaban a una fila distinta de la que se veía
   * debajo, y `Fin` no llevaba a la última.
   *
   * También evita el `indexOf` que hacía la plantilla, que recorría la lista
   * entera por cada fila y en cada repintado.
   */
  protected readonly groups = computed(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of this.rawEntries()) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    let index = 0;
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: items.map((entry) => ({ ...entry, index: index++ })),
    }));
  });

  /** La lista navegable es, literalmente, lo que se ve de arriba abajo. */
  protected readonly entries = computed<readonly Entry[]>(() =>
    this.groups().flatMap((group) => group.items),
  );

  /** Identificador de la fila activa, para que el lector de pantalla la anuncie. */
  protected readonly activeId = computed(() => {
    const entry = this.entries()[this.highlighted()];
    return entry ? `palette-${entry.id}` : null;
  });

  constructor() {
    // Al abrirse, la búsqueda parte de cero: reabrir con el término anterior
    // muestra resultados que ya no se estaban buscando.
    effect(() => {
      if (!this.open()) {
        window.clearTimeout(this.debounce);
        this.term.set('');
        this.highlighted.set(0);
        this.searching.set(false);
        this.patientEntries.set([]);
      }
    });
  }

  protected onInput(value: string): void {
    this.term.set(value);
    this.highlighted.set(0);

    const query = value.trim();
    if (query.length < 2 || !can.viewPatients(this.session.permissions())) {
      window.clearTimeout(this.debounce);
      this.searching.set(false);
      this.patientEntries.set([]);
      return;
    }

    // Se espera a que la persona deje de teclear. Sin esto, «Quispe» disparaba
    // seis búsquedas contra ms-pacientes y la lista parpadeaba con resultados
    // de prefijos que ya nadie estaba buscando.
    window.clearTimeout(this.debounce);
    this.searching.set(true);
    this.debounce = window.setTimeout(() => void this.buscarPacientes(query), 180);
  }

  private async buscarPacientes(query: string): Promise<void> {
    try {
      const page = await this.patients.search(query, 5);
      // Una respuesta que llega tarde no debe pisar una búsqueda más reciente.
      if (this.term().trim() !== query) {
        return;
      }
      this.patientEntries.set(
        page.content.map((patient) => ({
          id: `patient-${patient.patientId}`,
          icon: 'user' as IconName,
          title: patient.fullName,
          subtitle: `${label(DOCUMENT_TYPE_SHORT, patient.documentType)} ${formatDocument(patient.documentNumber, patient.documentComplement)}`,
          group: 'Pacientes',
          link: `/pacientes/${patient.patientId}`,
        })),
      );
    } catch {
      this.patientEntries.set([]);
    } finally {
      if (this.term().trim() === query) {
        this.searching.set(false);
      }
    }
  }

  /**
   * Coloca el foco y engancha el teclado a la capa entera.
   *
   * Antes el manejador vivía en un `<div>` del contenido, pero `showModal()`
   * enfoca el primer elemento enfocable —que es el botón de cerrar, en la
   * cabecera— y un `keydown` nace donde está el foco. Las flechas y el Enter
   * nunca llegaban al manejador; solo funcionaba `Esc`, que lo trata el propio
   * `<dialog>`. Escuchando en el elemento de la capa, funcionan esté donde esté
   * el foco.
   */
  protected onOpened(layer: HTMLDialogElement): void {
    layer.addEventListener('keydown', this.onKeyDown);
    layer.addEventListener('close', () => layer.removeEventListener('keydown', this.onKeyDown), {
      once: true,
    });
    // El foco va al campo, que es lo que se viene a hacer al abrir un buscador.
    // `autofocus` lo cubre en los navegadores que respetan los pasos de enfoque
    // de `<dialog>`; esto lo garantiza en el resto y al reabrir la capa.
    queueMicrotask(() => {
      const campo = this.campo()?.nativeElement;
      campo?.focus();
      campo?.select();
    });
  }

  /** Propiedad y no método: necesita la misma referencia para poder desengancharse. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Esc va primero y sin condiciones: el pie promete «Esc cerrar» y debe
    // cumplirlo con la lista vacía, con texto escrito o mientras se busca.
    // No se delega en el cierre nativo del `<dialog>` porque el campo de
    // búsqueda recibe la tecla antes y algunos navegadores la consumen.
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }

    const total = this.entries().length;
    if (total === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      // Da la vuelta al llegar al final: en una lista corta, tener que subir
      // catorce posiciones para volver al principio es peor que continuar.
      this.move((this.highlighted() + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move((this.highlighted() - 1 + total) % total);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.move(total - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.choose(this.entries()[this.highlighted()]);
    }
  };

  /** Mueve la selección y la trae a la vista: la lista se desplaza. */
  private move(index: number): void {
    this.highlighted.set(index);
    const entry = this.entries()[index];
    if (entry === undefined) {
      return;
    }
    queueMicrotask(() => {
      document.getElementById(`palette-${entry.id}`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected choose(entry: Entry | undefined): void {
    if (entry === undefined) {
      return;
    }
    this.closed.emit();
    void this.router.navigateByUrl(entry.link);
  }
}
