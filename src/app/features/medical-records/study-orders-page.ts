import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { STUDY_ORDER_STATUS, STUDY_PRIORITY, label, options } from '../../core/labels/labels';
import { studyOrderTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { Select } from '../../shared/select';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientName } from '../patients/patient-name';
import { RecordsService } from './records.service';

/**
 * Jerarquía: es una bandeja de trabajo. Lo primero que importa es en qué punto
 * del ciclo está cada orden y si es urgente; el paciente identifica la fila.
 */
@Component({
  selector: 'medsys-study-orders-page',
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
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './study-orders-page.html',
})
export class StudyOrdersPage {
  private readonly records = inject(RecordsService);
  private readonly router = inject(Router);

  protected readonly orderStatuses = STUDY_ORDER_STATUS;
  protected readonly orderTones = studyOrderTone;
  protected readonly priorities = STUDY_PRIORITY;
  protected readonly statusOptions = options(STUDY_ORDER_STATUS);

  protected readonly status = signal<string | null>(
    localStorage.getItem('medicalsys.orders.status') || null,
  );
  protected readonly page = signal(0);

  protected readonly list = this.records.studyOrdersResource(this.status, this.page);

  constructor() {
    effect(() => localStorage.setItem('medicalsys.orders.status', this.status() ?? ''));
  }

  protected setStatus(value: string): void {
    this.status.set(value || null);
    this.page.set(0);
  }

  protected statusLabel(): string {
    return label(STUDY_ORDER_STATUS, this.status()).toLowerCase();
  }

  protected open(orderId: string): void {
    void this.router.navigate(['/ordenes-estudio', orderId]);
  }

  protected onRowKey(event: KeyboardEvent, orderId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(orderId);
    }
  }
}
