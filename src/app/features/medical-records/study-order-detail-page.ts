import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  STUDY_ORDER_STATUS,
  STUDY_PRIORITY,
  STUDY_RESULT_STATUS,
  label,
  options,
} from '../../core/labels/labels';
import {
  STUDY_ORDER_TIMELINE,
  StudyOrderStatus,
  acceptsStudyResults,
  studyOrderTone,
  studyOrderTransitions,
} from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Select } from '../../shared/select';
import { Dialog } from '../../shared/dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientsService } from '../patients/patients.service';
import { RecordsService } from './records.service';

/**
 * Jerarquía: una orden es un proceso, así que lo primero es dónde está dentro
 * de ese proceso. La línea de tiempo va arriba; los resultados, que son el
 * producto final, ocupan el cuerpo de la vista.
 */
@Component({
  selector: 'medsys-study-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Select,
    PageHeader,
    StatusChip,
    ErrorState,
    Notice,
    Skeleton,
    Dialog,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  templateUrl: './study-order-detail-page.html',
})
export class StudyOrderDetailPage {
  readonly orderId = input.required<string>();

  private readonly records = inject(RecordsService);
  private readonly patients = inject(PatientsService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly orderStatuses = STUDY_ORDER_STATUS;
  protected readonly orderTones = studyOrderTone;
  protected readonly priorities = STUDY_PRIORITY;
  protected readonly resultStatuses = STUDY_RESULT_STATUS;
  protected readonly resultStatusOptions = options(STUDY_RESULT_STATUS);
  protected readonly timeline = STUDY_ORDER_TIMELINE;

  private readonly id = computed<string | null>(() => this.orderId());
  protected readonly order = this.records.studyOrderResource(this.id);

  private readonly patientId = computed(() => this.order.value()?.patientId ?? null);
  protected readonly patient = this.patients.patientResource(this.patientId);

  protected readonly status = computed<StudyOrderStatus>(
    () => this.order.value()?.status ?? 'REQUESTED',
  );
  protected readonly isVoided = computed(() => this.status() === 'VOIDED');
  protected readonly acceptsResults = computed(() => acceptsStudyResults(this.status()));
  /** Solo se ofrecen los destinos válidos según la máquina de estados. */
  protected readonly transitions = computed(() => studyOrderTransitions(this.status()));
  protected readonly currentIndex = computed(() => STUDY_ORDER_TIMELINE.indexOf(this.status()));

  protected readonly crumbs = computed(() => [
    { label: 'Órdenes de estudio', link: '/ordenes-estudio' },
    { label: this.order.value()?.studyTypeCode ?? 'Orden' },
  ]);

  protected readonly description = computed(() => {
    const person = this.patient.value();
    return person ? `Solicitada para ${person.fullName}.` : null;
  });

  protected readonly registering = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly changingTo = signal<StudyOrderStatus | null>(null);

  protected readonly parameter = signal('');
  protected readonly numericValue = signal('');
  protected readonly unit = signal('');
  protected readonly referenceMin = signal('');
  protected readonly referenceMax = signal('');
  protected readonly textValue = signal('');
  protected readonly resultStatus = signal('FINAL');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly hasValue = computed(
    () => this.numericValue().trim().length > 0 || this.textValue().trim().length > 0,
  );

  protected statusLabel(status: string): string {
    return label(STUDY_ORDER_STATUS, status);
  }

  protected transitionLabel(target: StudyOrderStatus): string {
    return target === 'VOIDED'
      ? 'Anular orden'
      : `Marcar como ${label(STUDY_ORDER_STATUS, target).toLowerCase()}`;
  }

  protected stepState(index: number): 'done' | 'current' | 'todo' {
    if (index < this.currentIndex()) return 'done';
    return index === this.currentIndex() ? 'current' : 'todo';
  }

  protected referenceRange(min: string | null, max: string | null): string | null {
    return min !== null && max !== null ? `${min} – ${max}` : null;
  }

  protected openResultForm(): void {
    this.parameter.set('');
    this.numericValue.set('');
    this.unit.set('');
    this.referenceMin.set('');
    this.referenceMax.set('');
    this.textValue.set('');
    this.failure.set(null);
    this.registering.set(true);
  }

  protected async changeStatus(target: StudyOrderStatus): Promise<void> {
    this.changingTo.set(target);
    try {
      const updated = await this.records.changeStudyOrderStatus(this.orderId(), target);
      this.order.reload();
      this.toasts.notify(`La orden pasó a «${this.statusLabel(updated.status).toLowerCase()}».`);
    } catch (failure) {
      this.toasts.notify(describeFailure(failure).message, 'err');
    } finally {
      this.changingTo.set(null);
    }
  }

  protected async saveResult(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.records.registerStudyResult(this.orderId(), {
        parameter: this.parameter().trim() || null,
        numericValue: this.numericValue() ? Number(this.numericValue()) : null,
        textValue: this.textValue().trim() || null,
        unit: this.unit().trim() || null,
        referenceMin: this.referenceMin() ? Number(this.referenceMin()) : null,
        referenceMax: this.referenceMax() ? Number(this.referenceMax()) : null,
        status: this.resultStatus(),
        reportedById: this.session.user()?.publicId ?? null,
      });
      this.order.reload();
      this.toasts.notify('Resultado registrado. La orden queda informada.');
      this.registering.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
