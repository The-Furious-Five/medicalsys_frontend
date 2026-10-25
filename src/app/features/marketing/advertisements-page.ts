import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { ADVERTISEMENT_PLACEMENT, ADVERTISEMENT_STATUS, options } from '../../core/labels/labels';
import {
  AdvertisementStatus,
  advertisementTone,
  advertisementTransitions,
} from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { MarketingService } from './marketing.service';
import { Advertisement } from './marketing.models';
import { NumberField } from '../../shared/number-field';
import { DateTimeField } from '../../shared/datetime-field';

/**
 * Jerarquía: a diferencia de la campaña, el anuncio es pasivo — no busca a nadie,
 * se muestra a quien entra al portal. Por eso lo que importa es si está publicado
 * y qué rendimiento tiene, no a quién alcanzó.
 *
 * Un anuncio institucional pertenece a la plataforma: se ve pero no se administra
 * desde aquí, y la interfaz no ofrece sus acciones en vez de mostrarlas y fallar.
 */
@Component({
  selector: 'medsys-advertisements-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    Dialog,
    Select,
    StatusChip,
    EmptyState,
    ErrorState,
    Notice,
    Pager,
    TableSkeleton,
    Icon,
    ReactiveFormsModule,
    ...FORMAT_PIPES,
    NumberField,
    DateTimeField,
  ],
  templateUrl: './advertisements-page.html',
})
export class AdvertisementsPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly placements = ADVERTISEMENT_PLACEMENT;
  protected readonly statuses = ADVERTISEMENT_STATUS;
  protected readonly tones = advertisementTone;
  protected readonly placementOptions = options(ADVERTISEMENT_PLACEMENT);

  protected readonly canManage = computed(() =>
    can.manageAdvertisements(this.session.permissions()),
  );

  protected readonly page = signal(0);
  protected readonly advertisements = this.marketing.advertisementsResource(
    this.page,
    20,
    computed(() => !this.session.permissions().includes('marketing.advertisement.read')),
  );

  protected readonly sheetOpen = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(180)]],
    content: [''],
    targetUrl: ['', [Validators.maxLength(500)]],
    placement: ['PATIENT_PORTAL', [Validators.required]],
    priority: ['5', [Validators.min(1), Validators.max(10)]],
    validFrom: [this.nowLocal(), [Validators.required]],
    validUntil: [this.nowLocal(30), [Validators.required]],
  });

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  /** Acciones válidas desde el estado actual; un anuncio ajeno no ofrece ninguna. */
  protected transitions(advertisement: Advertisement): readonly AdvertisementStatus[] {
    if (advertisement.institutional || !this.canManage()) {
      return [];
    }
    return advertisementTransitions(advertisement.status as AdvertisementStatus);
  }

  protected actionLabel(status: AdvertisementStatus): string {
    switch (status) {
      case 'PUBLISHED':
        return 'Publicar';
      case 'PAUSED':
        return 'Pausar';
      default:
        return 'Finalizar';
    }
  }

  protected async runAction(
    advertisement: Advertisement,
    status: AdvertisementStatus,
  ): Promise<void> {
    try {
      if (status === 'PUBLISHED') {
        await this.marketing.publishAdvertisement(advertisement.id);
      } else if (status === 'PAUSED') {
        await this.marketing.pauseAdvertisement(advertisement.id);
      } else {
        await this.marketing.finishAdvertisement(advertisement.id);
      }
      this.toasts.notify(`«${advertisement.title}» actualizado.`);
      this.advertisements.reload();
    } catch {
      this.toasts.notify('No se pudo cambiar el estado del anuncio.', 'err');
    }
  }

  protected errorFor(control: 'title'): string | null {
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

  protected readonly rangeError = computed(() => {
    const raw = this.form.getRawValue();
    return raw.validUntil !== '' && raw.validFrom !== '' && raw.validUntil <= raw.validFrom
      ? 'La vigencia debe terminar después de empezar.'
      : null;
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.rangeError() !== null) {
      return;
    }
    const raw = this.form.getRawValue();

    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.marketing.createAdvertisement({
        title: raw.title.trim(),
        content: raw.content.trim() === '' ? null : raw.content.trim(),
        targetUrl: raw.targetUrl.trim() === '' ? null : raw.targetUrl.trim(),
        serviceOfferingId: null,
        placement: raw.placement,
        priority: Number(raw.priority || '5'),
        validFrom: new Date(raw.validFrom).toISOString(),
        validUntil: new Date(raw.validUntil).toISOString(),
      });
      this.toasts.notify('Anuncio creado en borrador. Publícalo para que el portal lo muestre.');
      this.sheetOpen.set(false);
      this.form.reset({
        title: '',
        content: '',
        targetUrl: '',
        placement: 'PATIENT_PORTAL',
        priority: '5',
        validFrom: this.nowLocal(),
        validUntil: this.nowLocal(30),
      });
      this.advertisements.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  /** `datetime-local` espera `aaaa-mm-ddThh:mm` en hora local, sin zona. */
  private nowLocal(plusDays = 0): string {
    const at = new Date();
    at.setDate(at.getDate() + plusDays);
    at.setMinutes(at.getMinutes() - at.getTimezoneOffset());
    return at.toISOString().slice(0, 16);
  }
}
