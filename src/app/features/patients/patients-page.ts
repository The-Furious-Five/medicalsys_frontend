import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { DOCUMENT_TYPE_SHORT, PATIENT_STATUS, label } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientsService } from './patients.service';
import { RegisterPatientSheet } from './register-patient-sheet';
import { Patient } from './patients.models';

/**
 * Jerarquía: el registro de pacientes se recorre buscando, no leyendo. El campo
 * de búsqueda toma el foco al entrar y «/» lo recupera desde cualquier punto.
 */
@Component({
  selector: 'medsys-patients-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    RegisterPatientSheet,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './patients-page.html',
})
export class PatientsPage {
  private readonly patients = inject(PatientsService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly patientStatuses = PATIENT_STATUS;
  protected readonly canRegister = computed(() => can.registerPatient(this.session.permissions()));

  protected readonly term = signal('');
  /** Se busca al dejar de escribir: menos peticiones y menos parpadeo de
   *  resultados bajo el cursor. */
  protected readonly debounced = signal('');
  protected readonly page = signal(0);
  protected readonly registering = signal(false);

  private debounceTimer?: number;

  protected readonly results = this.patients.searchResource(this.debounced, this.page);

  constructor() {
    document.addEventListener('keydown', (event) => {
      const typingElsewhere =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === '/' && !typingElsewhere) {
        event.preventDefault();
        document.getElementById('patients-search')?.focus();
      }
    });
  }

  protected onSearch(value: string): void {
    this.term.set(value);
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.debounced.set(value.trim());
      this.page.set(0);
    }, 300);
  }

  protected clearSearch(): void {
    this.term.set('');
    this.debounced.set('');
    this.page.set(0);
  }

  protected documentLabel(patient: Patient): string {
    return label(DOCUMENT_TYPE_SHORT, patient.documentType);
  }

  protected open(patientId: string): void {
    void this.router.navigate(['/pacientes', patientId]);
  }

  protected onRowKey(event: KeyboardEvent, patientId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(patientId);
    }
  }
}
