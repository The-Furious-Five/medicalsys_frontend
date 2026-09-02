import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { describeFailure } from '../../../core/http/api-error';
import { FORMAT_PIPES } from '../../../core/format/format.pipe';
import { formatNumber } from '../../../core/format/format';
import { ToastService } from '../../../core/toast/toast.service';
import { Icon } from '../../../core/ui/icon';
import { Dialog } from '../../../shared/dialog';
import { Notice } from '../../../shared/notice';
import { Skeleton } from '../../../shared/skeleton';
import { RecordsService } from '../records.service';
import { VitalSign } from '../records.models';

interface Metric {
  readonly key: keyof VitalSign & string;
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: string;
  /** Rango de referencia adulto, solo para señalar lo llamativo. No diagnostica. */
  readonly normal?: readonly [number, number];
}

const METRICS: readonly Metric[] = [
  {
    key: 'heartRate',
    label: 'Frecuencia cardíaca',
    unit: 'lpm',
    min: 0,
    max: 400,
    step: '1',
    normal: [60, 100],
  },
  {
    key: 'respiratoryRate',
    label: 'Frecuencia respiratoria',
    unit: 'rpm',
    min: 0,
    max: 200,
    step: '1',
    normal: [12, 20],
  },
  {
    key: 'temperatureC',
    label: 'Temperatura',
    unit: '°C',
    min: 25,
    max: 45,
    step: '0.1',
    normal: [36, 37.5],
  },
  {
    key: 'oxygenSaturation',
    label: 'Saturación',
    unit: '%',
    min: 30,
    max: 100,
    step: '1',
    normal: [95, 100],
  },
  {
    key: 'bloodGlucoseMgDl',
    label: 'Glucemia',
    unit: 'mg/dL',
    min: 0,
    max: 2000,
    step: '1',
    normal: [70, 140],
  },
  { key: 'weightKg', label: 'Peso', unit: 'kg', min: 0.1, max: 500, step: '0.1' },
  { key: 'heightCm', label: 'Talla', unit: 'cm', min: 10, max: 300, step: '0.1' },
  {
    key: 'abdominalCircumferenceCm',
    label: 'Perímetro abdominal',
    unit: 'cm',
    min: 10,
    max: 300,
    step: '0.1',
  },
  { key: 'painScale', label: 'Dolor', unit: '/10', min: 0, max: 10, step: '1' },
];

/**
 * Signos vitales. Cifras grandes y tabulares porque se leen de un vistazo y se
 * comparan entre sí; lo que queda fuera de rango se marca con color **y** con
 * la palabra «fuera de rango», nunca solo con color.
 */
@Component({
  selector: 'medsys-vitals-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Dialog, Notice, Skeleton, ...FORMAT_PIPES],
  templateUrl: './vitals-panel.html',
})
export class VitalsPanel {
  readonly encounterId = input.required<string>();
  readonly editable = input(false);

  private readonly records = inject(RecordsService);
  private readonly toasts = inject(ToastService);

  protected readonly metrics = METRICS;
  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly vitals = this.records.vitalsResource(this.id);

  protected readonly latest = computed(() => {
    const list = this.vitals.value() ?? [];
    return list.length > 0 ? list[list.length - 1] : null;
  });

  protected readonly takeCount = computed(() => (this.vitals.value() ?? []).length);

  protected readonly adding = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly draft = signal<Record<string, string>>({});

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly anyValue = computed(() =>
    Object.values(this.draft()).some((value) => value !== ''),
  );

  /** Presión arterial: se muestra unida porque se lee como un solo dato. */
  protected readonly pressure = computed(() => {
    const vital = this.latest();
    if (vital?.systolicPressure == null || vital.diastolicPressure == null) {
      return null;
    }
    return {
      text: `${vital.systolicPressure}/${vital.diastolicPressure}`,
      high: vital.systolicPressure >= 140 || vital.diastolicPressure >= 90,
    };
  });

  protected readonly shownMetrics = computed(() => {
    const vital = this.latest();
    if (vital === null) {
      return [];
    }
    return METRICS.filter(
      (metric) => vital[metric.key] !== null && vital[metric.key] !== undefined,
    ).map((metric) => {
      const numeric = Number(vital[metric.key]);
      const out =
        metric.normal !== undefined && (numeric < metric.normal[0] || numeric > metric.normal[1]);
      return {
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        value: formatNumber(numeric, Number.isInteger(numeric) ? 0 : 1),
        out,
      };
    });
  });

  protected setDraft(key: string, value: string): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected draftValue(key: string): string {
    return this.draft()[key] ?? '';
  }

  protected openForm(): void {
    this.draft.set({});
    this.failure.set(null);
    this.adding.set(true);
  }

  protected async save(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      const body: Record<string, unknown> = { measuredAt: new Date().toISOString() };
      for (const [key, value] of Object.entries(this.draft())) {
        if (value !== '') {
          body[key] = Number(value);
        }
      }
      await this.records.createVital(this.encounterId(), body);
      this.vitals.reload();
      this.toasts.notify('Toma de signos vitales registrada.');
      this.adding.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
