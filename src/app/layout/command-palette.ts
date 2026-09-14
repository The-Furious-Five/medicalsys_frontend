import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
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

  protected readonly term = signal('');
  protected readonly highlighted = signal(0);
  protected readonly searching = signal(false);
  private readonly patientEntries = signal<readonly Entry[]>([]);

  private readonly offerings = this.tenancy.offeringsResource();

  protected readonly entries = computed<readonly Entry[]>(() => {
    const normalized = this.term().trim().toLowerCase();
    const roles = this.session.roles();
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

    for (const group of visibleNav(roles)) {
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

    if (can.issueInvoice(roles) && (!normalized || 'emitir factura'.includes(normalized))) {
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

  protected readonly groups = computed(() => {
    const map = new Map<string, Entry[]>();
    let index = 0;
    for (const entry of this.entries()) {
      const list = map.get(entry.group) ?? [];
      list.push({ ...entry, id: entry.id });
      map.set(entry.group, list);
    }
    void index;
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  });

  constructor() {
    // Al abrirse, la búsqueda parte de cero: reabrir con el término anterior
    // muestra resultados que ya no se estaban buscando.
    effect(() => {
      if (!this.open()) {
        this.term.set('');
        this.highlighted.set(0);
        this.patientEntries.set([]);
      }
    });
  }

  protected indexOf(entry: Entry): number {
    return this.entries().findIndex((candidate) => candidate.id === entry.id);
  }

  protected async onInput(value: string): Promise<void> {
    this.term.set(value);
    this.highlighted.set(0);

    const query = value.trim();
    if (query.length < 2 || !can.viewPatients(this.session.roles())) {
      this.patientEntries.set([]);
      return;
    }

    this.searching.set(true);
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

  protected onKeyDown(event: KeyboardEvent): void {
    const total = this.entries().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlighted.update((current) => Math.min(current + 1, total - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlighted.update((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.choose(this.entries()[this.highlighted()]);
    }
  }

  protected choose(entry: Entry | undefined): void {
    if (entry === undefined) {
      return;
    }
    this.closed.emit();
    void this.router.navigateByUrl(entry.link);
  }
}
