import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { RECORD_STATUS } from '../../core/labels/labels';
import { recordTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientName } from '../patients/patient-name';
import { OpenRecordDialog } from './open-record-dialog';
import { RecordsService } from './records.service';

/**
 * Jerarquía: el expediente se identifica por su número, pero se busca por
 * persona. Por eso el nombre del paciente encabeza la fila y el número queda
 * como dato secundario.
 */
@Component({
  selector: 'medsys-records-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    TableSkeleton,
    Pager,
    PatientName,
    OpenRecordDialog,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './records-page.html',
})
export class RecordsPage {
  private readonly records = inject(RecordsService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly recordStatuses = RECORD_STATUS;
  protected readonly recordTones = recordTone;
  protected readonly canOpen = computed(() => can.openRecord(this.session.permissions()));

  protected readonly page = signal(0);
  protected readonly opening = signal(false);
  protected readonly list = this.records.recordsResource(this.page);

  protected open(recordId: string): void {
    void this.router.navigate(['/expedientes', recordId]);
  }

  protected onRowKey(event: KeyboardEvent, recordId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(recordId);
    }
  }
}
