import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { describeFailure } from '../../../core/http/api-error';
import { FORMAT_PIPES } from '../../../core/format/format.pipe';
import {
  ADMINISTRATION_ROUTE,
  PRESCRIPTION_STATUS,
  label,
  options,
} from '../../../core/labels/labels';
import {
  PrescriptionStatus,
  prescriptionTone,
  prescriptionTransitions,
} from '../../../core/state/state-machines';
import { ToastService } from '../../../core/toast/toast.service';
import { Icon } from '../../../core/ui/icon';
import { Dialog } from '../../../shared/dialog';
import { Notice } from '../../../shared/notice';
import { Skeleton } from '../../../shared/skeleton';
import { StatusChip } from '../../../shared/status-chip';
import { Select, SelectOption } from '../../../shared/select';
import { RecordsService } from '../records.service';
import { Prescription, PrescriptionItem } from '../records.models';

interface ItemDraft {
  key: string;
  description: string;
  dose: string;
  route: string;
  frequencyHours: string;
  durationDays: string;
  instructions: string;
}

const newItem = (): ItemDraft => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: '',
  dose: '',
  route: 'ORAL',
  frequencyHours: '',
  durationDays: '',
  instructions: '',
});

/**
 * Recetas del encuentro. Una receta es un documento con folio propio, así que
 * se muestra como unidad cerrada con sus medicamentos dentro, no como una lista
 * plana de fármacos sueltos.
 */
@Component({
  selector: 'medsys-prescriptions-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Dialog, Notice, Skeleton, StatusChip, Select, ...FORMAT_PIPES],
  templateUrl: './prescriptions-panel.html',
})
export class PrescriptionsPanel {
  readonly encounterId = input.required<string>();
  readonly editable = input(false);

  private readonly records = inject(RecordsService);
  private readonly toasts = inject(ToastService);

  protected readonly prescriptionStatuses = PRESCRIPTION_STATUS;
  protected readonly prescriptionTones = prescriptionTone;
  protected readonly routeOptions = options(ADMINISTRATION_ROUTE);

  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly prescriptions = this.records.prescriptionsResource(this.id);

  protected readonly creating = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly items = signal<readonly ItemDraft[]>([newItem()]);
  protected readonly validityDays = signal('30');
  protected readonly generalInstructions = signal('');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly valid = computed(() => {
    const items = this.items();
    return (
      items.length > 0 &&
      items.every((item) => item.description.trim().length > 0 && item.dose.trim().length > 0)
    );
  });

  /** Solo se ofrecen los estados a los que el backend permite transitar. */
  /** Solo los destinos que el backend permite, ya con su texto en español. */
  protected transitionsFor(status: PrescriptionStatus): readonly SelectOption[] {
    return prescriptionTransitions(status).map((target) => ({
      value: target,
      label: label(PRESCRIPTION_STATUS, target),
    }));
  }

  protected statusLabel(status: string): string {
    return label(PRESCRIPTION_STATUS, status);
  }

  protected itemLine(item: PrescriptionItem): string {
    return [
      item.dose,
      item.administrationRoute ? label(ADMINISTRATION_ROUTE, item.administrationRoute) : null,
      item.frequencyHours ? `cada ${item.frequencyHours} h` : null,
      item.durationDays ? `durante ${item.durationDays} días` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected itemName(item: PrescriptionItem): string {
    return item.freeTextDescription ?? item.medicationCode ?? 'Medicamento';
  }

  protected openForm(): void {
    this.items.set([newItem()]);
    this.generalInstructions.set('');
    this.failure.set(null);
    this.creating.set(true);
  }

  protected addItem(): void {
    this.items.update((current) => [...current, newItem()]);
  }

  protected removeItem(key: string): void {
    this.items.update((current) => current.filter((item) => item.key !== key));
  }

  protected patchItem(key: string, field: keyof ItemDraft, value: string): void {
    this.items.update((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

  protected async changeStatus(prescription: Prescription, next: string): Promise<void> {
    if (!next) {
      return;
    }
    try {
      const updated = await this.records.changePrescriptionStatus(
        prescription.id,
        next as PrescriptionStatus,
      );
      this.prescriptions.reload();
      this.toasts.notify(`La receta pasó a «${this.statusLabel(updated.status).toLowerCase()}».`);
    } catch (failure) {
      this.toasts.notify(describeFailure(failure).message, 'err');
    }
  }

  protected async save(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      const prescription = await this.records.createPrescription(this.encounterId(), {
        validityDays: this.validityDays() ? Number(this.validityDays()) : null,
        generalInstructions: this.generalInstructions().trim() || null,
        items: this.items().map((item) => ({
          freeTextDescription: item.description.trim() || null,
          dose: item.dose.trim(),
          administrationRoute: item.route || null,
          frequencyHours: item.frequencyHours ? Number(item.frequencyHours) : null,
          durationDays: item.durationDays ? Number(item.durationDays) : null,
          instructions: item.instructions.trim() || null,
        })),
      });
      this.prescriptions.reload();
      this.toasts.notify(`Receta ${prescription.folio} emitida.`);
      this.creating.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
