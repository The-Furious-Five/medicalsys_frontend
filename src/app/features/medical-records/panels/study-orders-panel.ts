import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { describeFailure } from '../../../core/http/api-error';
import { FORMAT_PIPES } from '../../../core/format/format.pipe';
import { STUDY_ORDER_STATUS, STUDY_PRIORITY, options } from '../../../core/labels/labels';
import { studyOrderTone } from '../../../core/state/state-machines';
import { ToastService } from '../../../core/toast/toast.service';
import { Icon } from '../../../core/ui/icon';
import { Select } from '../../../shared/select';
import { Dialog } from '../../../shared/dialog';
import { Notice } from '../../../shared/notice';
import { Skeleton } from '../../../shared/skeleton';
import { StatusChip } from '../../../shared/status-chip';
import { RecordsService } from '../records.service';

/** Órdenes de estudio solicitadas desde este encuentro. */
@Component({
  selector: 'medsys-study-orders-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, RouterLink, Icon, Dialog, Notice, Skeleton, StatusChip, ...FORMAT_PIPES],
  templateUrl: './study-orders-panel.html',
})
export class StudyOrdersPanel {
  readonly encounterId = input.required<string>();
  readonly editable = input(false);

  private readonly records = inject(RecordsService);
  private readonly toasts = inject(ToastService);

  protected readonly orderStatuses = STUDY_ORDER_STATUS;
  protected readonly orderTones = studyOrderTone;
  protected readonly priorities = STUDY_PRIORITY;
  protected readonly priorityOptions = options(STUDY_PRIORITY);

  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly orders = this.records.studyOrdersByEncounterResource(this.id);

  protected readonly creating = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly studyTypeCode = signal('');
  protected readonly priority = signal('ROUTINE');
  protected readonly instructions = signal('');
  protected readonly icd10Code = signal('');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected openForm(): void {
    this.studyTypeCode.set('');
    this.instructions.set('');
    this.icd10Code.set('');
    this.failure.set(null);
    this.creating.set(true);
  }

  protected async save(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.records.createStudyOrder(this.encounterId(), {
        studyTypeCode: this.studyTypeCode().trim().toUpperCase(),
        priority: this.priority(),
        instructions: this.instructions().trim() || null,
        icd10Code: this.icd10Code().trim().toUpperCase() || null,
      });
      this.orders.reload();
      this.toasts.notify('Orden de estudio solicitada.');
      this.creating.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
