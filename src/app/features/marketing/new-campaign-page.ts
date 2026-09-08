import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { CAMPAIGN_CHANNEL, CAMPAIGN_TYPE, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Select, SelectOption } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { MarketingService } from './marketing.service';
import { NumberField } from '../../shared/number-field';
import { DateTimeField } from '../../shared/datetime-field';

/**
 * Jerarquía: crear una campaña son tres decisiones — qué se comunica, a quién y
 * cuándo. Nace siempre en borrador: nada sale hasta que alguien la lance
 * explícitamente desde su ficha, y en medio queda el paso de congelar la
 * audiencia, que es donde se revisa a cuánta gente va a llegar.
 */
@Component({
  selector: 'medsys-new-campaign-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Select,
    Notice,
    Skeleton,
    Icon,
    RouterLink,
    ReactiveFormsModule,
    ...FORMAT_PIPES,
    NumberField,
    DateTimeField,
  ],
  templateUrl: './new-campaign-page.html',
})
export class NewCampaignPage {
  private readonly marketing = inject(MarketingService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly types = options(CAMPAIGN_TYPE);
  protected readonly channels = options(CAMPAIGN_CHANNEL);

  private readonly activeSegments = signal<boolean | null>(true);
  private readonly activePromotions = signal<boolean | null>(true);
  private readonly firstPage = signal(0);

  protected readonly segments = this.marketing.segmentsResource(
    this.activeSegments,
    this.firstPage,
    50,
  );
  protected readonly promotions = this.marketing.promotionsResource(
    this.activePromotions,
    this.firstPage,
    50,
  );

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['PREVENTIVE', [Validators.required]],
    channel: ['WHATSAPP', [Validators.required]],
    objective: ['', [Validators.maxLength(300)]],
    segmentId: ['', [Validators.required]],
    promotionId: [''],
    startsAt: [this.nowLocal(), [Validators.required]],
    endsAt: [''],
    budgetBob: [''],
  });

  protected readonly segmentOptions = computed<readonly SelectOption[]>(() =>
    (this.segments.value()?.content ?? []).map((segment) => ({
      value: segment.id,
      label:
        segment.estimatedSize === null
          ? segment.name
          : `${segment.name} · ${segment.estimatedSize} paciente(s)`,
    })),
  );

  protected readonly promotionOptions = computed<readonly SelectOption[]>(() =>
    (this.promotions.value()?.content ?? []).map((promotion) => ({
      value: promotion.id,
      label: `${promotion.couponCode} · ${promotion.name}`,
    })),
  );

  /** Alcance del segmento elegido, para no crear una campaña a ciegas. */
  protected readonly chosenSegment = computed(() => {
    const id = this.form.controls.segmentId.value;
    return (this.segments.value()?.content ?? []).find((segment) => segment.id === id) ?? null;
  });

  protected readonly noSegments = computed(
    () => !this.segments.isLoading() && (this.segments.value()?.content.length ?? 0) === 0,
  );

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  protected errorFor(control: 'name' | 'segmentId' | 'startsAt'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || field.valid) {
      return null;
    }
    if (field.hasError('required')) {
      return control === 'segmentId'
        ? 'Elige a quién va dirigida la campaña'
        : 'Este campo es obligatorio';
    }
    if (field.hasError('maxlength')) {
      return `Máximo ${field.getError('maxlength').requiredLength} caracteres`;
    }
    return null;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const raw = this.form.getRawValue();

    this.pending.set(true);
    this.failure.set(null);
    try {
      const campaign = await this.marketing.createCampaign({
        name: raw.name.trim(),
        type: raw.type,
        channel: raw.channel,
        objective: raw.objective.trim() === '' ? null : raw.objective.trim(),
        segmentId: raw.segmentId === '' ? null : raw.segmentId,
        promotionId: raw.promotionId === '' ? null : raw.promotionId,
        startsAt: new Date(raw.startsAt).toISOString(),
        endsAt: raw.endsAt === '' ? null : new Date(raw.endsAt).toISOString(),
        budgetBob: raw.budgetBob === '' ? null : Number(raw.budgetBob),
      });
      this.toasts.notify(
        `Campaña «${campaign.name}» creada en borrador. Congela su audiencia antes de lanzarla.`,
      );
      await this.router.navigate(['/campanas', campaign.id], { replaceUrl: true });
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  /** `datetime-local` espera `aaaa-mm-ddThh:mm` en hora local, sin zona. */
  private nowLocal(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
}
