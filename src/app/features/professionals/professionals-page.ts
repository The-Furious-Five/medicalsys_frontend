import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import {
  PROFESSIONAL_LINK_STATUS,
  PROFESSIONAL_TYPE,
  WORK_MODALITY,
  label,
} from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { RegisterProfessionalSheet } from './register-professional-sheet';
import { Professional, ProfessionalOrganizationLink } from './professionals.models';
import { ProfessionalsService, primarySpecialtyCode } from './professionals.service';

/**
 * Directorio de profesionales del centro.
 *
 * La especialidad se filtra en el servidor y el texto en memoria, y no es una
 * incoherencia: el padrón de un centro son decenas de personas, así que buscar
 * por nombre o matrícula sobre la lista ya cargada responde a cada tecla sin
 * ida y vuelta; la especialidad, en cambio, es el `specialtyCode` que la
 * consulta del backend sabe aplicar mejor que nosotros.
 */
@Component({
  selector: 'medsys-professionals-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    RegisterProfessionalSheet,
    Icon,
  ],
  templateUrl: './professionals-page.html',
})
export class ProfessionalsPage {
  private readonly professionals = inject(ProfessionalsService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly professionalTypes = PROFESSIONAL_TYPE;
  protected readonly linkStatuses = PROFESSIONAL_LINK_STATUS;
  protected readonly canManage = computed(() =>
    can.manageProfessionals(this.session.permissions()),
  );

  protected readonly term = signal('');
  protected readonly specialty = signal<string | null>(null);
  protected readonly registering = signal(false);

  protected readonly directory = this.professionals.professionalsResource(this.specialty);
  protected readonly specialties = this.professionals.specialtiesResource();

  /** Códigos a nombres, para no imprimir «CARD» donde se espera «Cardiología». */
  private readonly specialtyNames = computed(
    () => new Map((this.specialties.value() ?? []).map((item) => [item.code, item.name])),
  );

  protected readonly specialtyOptions = computed(() =>
    (this.specialties.value() ?? []).map((item) => ({ value: item.code, label: item.name })),
  );

  protected readonly results = computed<readonly Professional[]>(() => {
    const all = this.directory.value() ?? [];
    const needle = this.term().trim().toLowerCase();
    if (needle === '') {
      return all;
    }
    return all.filter(
      (person) =>
        person.fullName.toLowerCase().includes(needle) ||
        person.licenseNumber.toLowerCase().includes(needle),
    );
  });

  protected readonly countLabel = computed(() => {
    const total = this.results().length;
    return total === 1 ? '1 profesional' : `${total} profesionales`;
  });

  /** Cierto cuando la lista llegó llena y es la búsqueda la que la vació. */
  protected readonly filteredOut = computed(
    () => this.results().length === 0 && (this.directory.value() ?? []).length > 0,
  );

  protected specialtyLabel(person: Professional): string {
    const code = primarySpecialtyCode(person);
    return code === null ? '—' : (this.specialtyNames().get(code) ?? code);
  }

  protected typeLabel(person: Professional): string {
    return label(PROFESSIONAL_TYPE, person.professionalType);
  }

  protected modalityLabel(person: Professional): string {
    return label(WORK_MODALITY, this.link(person)?.modality);
  }

  /**
   * Vínculo con este centro. La fila describe la relación local, no la persona:
   * quien también atiende en otra clínica no debe verse aquí con la modalidad
   * ni el estado de aquella.
   */
  protected link(person: Professional): ProfessionalOrganizationLink | undefined {
    const organizationId = this.professionals.organizationId();
    const links = person.organizations.filter((item) => item.organizationId === organizationId);
    return links.find((item) => item.status === 'ACTIVE') ?? links[0];
  }

  protected clearSearch(): void {
    this.term.set('');
  }

  protected onSpecialty(code: string): void {
    this.specialty.set(code === '' ? null : code);
  }

  protected open(professionalId: string): void {
    void this.router.navigate(['/profesionales', professionalId]);
  }

  protected onRowKey(event: KeyboardEvent, professionalId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(professionalId);
    }
  }
}
