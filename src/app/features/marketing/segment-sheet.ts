import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeFailure } from '../../core/http/api-error';
import { MONTH, SEX, label, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select, SelectOption } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { TenancyService } from '../tenancy/tenancy.service';
import { MarketingService } from './marketing.service';
import { Segment, SegmentPreview } from './marketing.models';
import { NumberField } from '../../shared/number-field';
import {
  CriteriaForm,
  EMPTY_CRITERIA,
  describeCriteria,
  toCriteria,
  toForm,
  validationError,
} from './segment-criteria';

/** Espera antes de recalcular el alcance mientras se escribe. */
const PREVIEW_DEBOUNCE_MS = 600;

/**
 * Constructor de audiencias.
 *
 * Los campos que ofrece **son** la lista blanca del servicio: edad, sexo, ciudad,
 * cumpleaños, y la actividad comercial del paciente. No hay ningún campo para
 * diagnóstico, alergia ni nada del expediente, y no lo hay porque el servicio los
 * rechaza con `422 CLINICAL_DATA_NOT_ALLOWED`. Ofrecer un campo que el backend va
 * a rechazar haría trabajar al usuario para nada; no ofrecerlo convierte la
 * promesa de privacidad en algo que se ve, no que se lee en un aviso.
 *
 * El alcance se calcula mientras se escribe. Ver a cuánta gente llega el criterio
 * antes de guardarlo es lo que evita el error caro: una campaña lanzada sobre una
 * audiencia equivocada ya no se recoge.
 */
@Component({
  selector: 'medsys-segment-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, Select, DateField, Icon, Skeleton, ReactiveFormsModule, NumberField],
  templateUrl: './segment-sheet.html',
})
export class SegmentSheet {
  readonly open = input(false);
  readonly segment = input<Segment | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly marketing = inject(MarketingService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly months = options(MONTH);
  protected readonly sexes = Object.keys(SEX);
  protected readonly sexLabel = (value: string) => label(SEX, value);

  private readonly activeOfferings = signal<boolean | null>(true);
  private readonly offerings = this.tenancy.offeringsResource(this.activeOfferings);

  protected readonly isEdit = computed(() => this.segment() !== null);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly preview = signal<SegmentPreview | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewFailure = signal<unknown>(null);
  private previewTimer?: number;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(300)]],
    minAge: [''],
    maxAge: [''],
    sex: [[] as string[]],
    cities: [''],
    birthdayMonth: [''],
    lastVisitBefore: [''],
    lastVisitAfter: [''],
    minAppointments: [''],
    maxNoShows: [''],
    minTotalBilledBob: [''],
    lastServiceOfferingId: [''],
    controlDueBefore: [''],
    excludeCampaignId: [''],
  });

  protected readonly offeringOptions = computed<readonly SelectOption[]>(() =>
    (this.offerings.value()?.content ?? []).map((offering) => ({
      value: offering.id,
      label: offering.name,
    })),
  );

  /** Cuántos ejes están declarados: con cero, el segmento sería «todo el mundo». */
  protected readonly axisCount = signal(0);
  protected readonly criteriaSummary = signal(
    'Elige un ejemplo o completa un solo filtro para empezar.',
  );

  protected readonly rangeError = signal<string | null>(null);

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  protected readonly previewMessage = computed(() => {
    const failure = this.previewFailure();
    return failure === null ? null : describeFailure(failure);
  });

  constructor() {
    // Al abrir se rellena con lo que haya y se calcula el alcance de partida.
    effect(() => {
      if (!this.open()) {
        return;
      }
      const segment = this.segment();
      const criteria = toForm(segment?.criteria);
      this.failure.set(null);
      this.previewFailure.set(null);
      this.preview.set(null);
      this.form.reset({
        name: segment?.name ?? '',
        description: segment?.description ?? '',
        ...criteria,
        sex: [...criteria.sex],
      });
      // El nombre es la clave por la que la organización reconoce el segmento y
      // lleva restricción de unicidad: el servicio no admite cambiarlo.
      if (segment) {
        this.form.controls.name.disable();
        this.refreshPreview();
      } else {
        this.form.controls.name.enable();
        this.axisCount.set(0);
        this.criteriaSummary.set('Elige un ejemplo o completa un solo filtro para empezar.');
      }
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.schedulePreview());
  }

  protected toggleSex(value: string, checked: boolean): void {
    const current = this.form.controls.sex.value;
    this.form.controls.sex.setValue(
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  }

  protected isSexChecked(value: string): boolean {
    return this.form.controls.sex.value.includes(value);
  }

  /** Recalcula tras una pausa: pedir en cada tecla castigaría al servicio sin ganar nada. */
  private schedulePreview(): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.refreshPreview(), PREVIEW_DEBOUNCE_MS);
  }

  protected async refreshPreview(): Promise<void> {
    const raw = this.criteriaForm();
    const error = validationError(raw);
    this.rangeError.set(error);

    const criteria = toCriteria(raw);
    const count = Object.keys(criteria).length;
    this.axisCount.set(count);
    this.criteriaSummary.set(
      count === 0
        ? 'Elige un ejemplo o completa un solo filtro para empezar.'
        : describeCriteria(criteria, this.sexLabel),
    );

    if (error !== null || count === 0) {
      this.preview.set(null);
      return;
    }

    this.previewing.set(true);
    this.previewFailure.set(null);
    try {
      this.preview.set(await this.marketing.previewCriteria(criteria));
    } catch (failure) {
      this.preview.set(null);
      this.previewFailure.set(failure);
    } finally {
      this.previewing.set(false);
    }
  }

  protected errorFor(control: 'name'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) return 'Este campo es obligatorio';
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    return null;
  }

  protected clearCriteria(): void {
    this.form.patchValue({ ...EMPTY_CRITERIA, sex: [] });
  }

  /** Ejemplos cotidianos que evitan tener que entender todos los campos antes de empezar. */
  protected applyExample(example: 'reactivation' | 'birthday' | 'frequent'): void {
    const date = new Date();
    const criteria: CriteriaForm = { ...EMPTY_CRITERIA, sex: [] };
    if (example === 'reactivation') {
      date.setMonth(date.getMonth() - 6);
      criteria.lastVisitBefore = this.isoDate(date);
    } else if (example === 'birthday') {
      criteria.birthdayMonth = String(new Date().getMonth() + 1);
    } else {
      criteria.minAppointments = '3';
    }
    this.form.patchValue({ ...criteria, sex: [...criteria.sex] });
  }

  private isoDate(value: Date): string {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  /** El formulario lleva el nombre y la descripción además del criterio; aquí se separa. */
  private criteriaForm(): CriteriaForm {
    const { name: _name, description: _description, ...criteria } = this.form.getRawValue();
    return criteria;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const raw = this.criteriaForm();
    const description = this.form.controls.description.value.trim();
    const rangeError = validationError(raw);
    this.rangeError.set(rangeError);

    if (this.form.invalid || rangeError !== null) {
      return;
    }
    const criteria = toCriteria(raw);
    if (Object.keys(criteria).length === 0) {
      this.rangeError.set(
        'Declara al menos un criterio: un segmento sin filtros sería toda la base de pacientes.',
      );
      return;
    }

    this.pending.set(true);
    this.failure.set(null);
    try {
      const segment = this.segment();
      if (segment) {
        await this.marketing.updateSegment(segment.id, {
          description: description === '' ? null : description,
          criteria,
        });
        this.toasts.notify(`Segmento «${segment.name}» actualizado.`);
      } else {
        const created = await this.marketing.createSegment({
          name: this.form.controls.name.value.trim(),
          description: description === '' ? null : description,
          criteria,
        });
        this.toasts.notify(
          `Segmento «${created.name}» creado: alcanza a ${created.estimatedSize ?? 0} paciente(s).`,
        );
      }
      this.saved.emit();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
