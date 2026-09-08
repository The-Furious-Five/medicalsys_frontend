import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { ENCOUNTER_STATUS, ENCOUNTER_TYPE, label, options } from '../../core/labels/labels';
import { encounterTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { Select } from '../../shared/select';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientName } from '../patients/patient-name';
import { OpenEncounterDialog } from './open-encounter-dialog';
import { RecordsService } from './records.service';

/**
 * Jerarquía: en una bandeja de encuentros lo urgente son los borradores sin
 * firmar. El estado es la primera columna de color de la fila para que el ojo
 * los encuentre sin tener que leer.
 */
@Component({
  selector: 'medsys-encounters-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Select,
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    PatientName,
    OpenEncounterDialog,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './encounters-page.html',
})
export class EncountersPage {
  private readonly records = inject(RecordsService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly encounterStatuses = ENCOUNTER_STATUS;
  protected readonly encounterTones = encounterTone;
  protected readonly statusOptions = options(ENCOUNTER_STATUS);
  protected readonly canOpen = computed(() => can.openEncounter(this.session.roles()));

  protected readonly status = signal<string | null>(
    localStorage.getItem('medicalsys.encounters.status') || null,
  );
  protected readonly page = signal(0);
  protected readonly opening = signal(false);

  protected readonly list = this.records.encountersResource(this.status, this.page);

  constructor() {
    effect(() => localStorage.setItem('medicalsys.encounters.status', this.status() ?? ''));
  }

  protected setStatus(value: string): void {
    this.status.set(value || null);
    this.page.set(0);
  }

  protected statusLabel(): string {
    return label(ENCOUNTER_STATUS, this.status()).toLowerCase();
  }

  protected typeLabel(type: string): string {
    return label(ENCOUNTER_TYPE, type);
  }

  protected open(encounterId: string): void {
    void this.router.navigate(['/encuentros', encounterId]);
  }

  protected onRowKey(event: KeyboardEvent, encounterId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(encounterId);
    }
  }
}
