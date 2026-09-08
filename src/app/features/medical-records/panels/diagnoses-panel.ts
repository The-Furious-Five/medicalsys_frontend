import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { describeFailure } from '../../../core/http/api-error';
import {
  DIAGNOSIS_STATUS,
  DIAGNOSIS_TYPE,
  LATERALITY,
  label,
  options,
} from '../../../core/labels/labels';
import { ToastService } from '../../../core/toast/toast.service';
import { Icon } from '../../../core/ui/icon';
import { Select } from '../../../shared/select';
import { Dialog } from '../../../shared/dialog';
import { Notice } from '../../../shared/notice';
import { Skeleton } from '../../../shared/skeleton';
import { StatusChip } from '../../../shared/status-chip';
import { RecordsService } from '../records.service';

/**
 * Diagnósticos del encuentro. El código CIE-10 se escribe a mano porque el
 * catálogo vive en otro servicio; se muestra en monoespaciada para que un
 * código mal tecleado salte a la vista antes de guardarlo.
 */
@Component({
  selector: 'medsys-diagnoses-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, Icon, Dialog, Notice, Skeleton, StatusChip],
  templateUrl: './diagnoses-panel.html',
})
export class DiagnosesPanel {
  readonly encounterId = input.required<string>();
  readonly editable = input(false);

  private readonly records = inject(RecordsService);
  private readonly toasts = inject(ToastService);

  protected readonly diagnosisTypes = DIAGNOSIS_TYPE;
  protected readonly diagnosisStatuses = DIAGNOSIS_STATUS;
  protected readonly typeOptions = options(DIAGNOSIS_TYPE);
  protected readonly lateralityOptions = options(LATERALITY);

  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly diagnoses = this.records.diagnosesResource(this.id);

  protected readonly adding = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly icd10Code = signal('');
  protected readonly type = signal('PROVISIONAL');
  protected readonly laterality = signal('NOT_APPLICABLE');
  protected readonly primary = signal(false);
  protected readonly chronic = signal(false);
  protected readonly observation = signal('');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected lateralityLabel(value: string | null): string {
    return label(LATERALITY, value);
  }

  protected openForm(): void {
    this.icd10Code.set('');
    this.observation.set('');
    this.primary.set(false);
    this.chronic.set(false);
    this.failure.set(null);
    this.adding.set(true);
  }

  protected async save(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.records.createDiagnosis(this.encounterId(), {
        icd10Code: this.icd10Code().trim().toUpperCase(),
        type: this.type(),
        primary: this.primary(),
        chronic: this.chronic(),
        laterality: this.laterality(),
        observation: this.observation().trim() || null,
      });
      this.diagnoses.reload();
      this.toasts.notify('Diagnóstico añadido al encuentro.');
      this.adding.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
