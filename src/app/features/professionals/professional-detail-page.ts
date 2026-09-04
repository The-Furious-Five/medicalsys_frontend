import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { describeFailure } from '../../core/http/api-error';
import {
  PROFESSIONAL_LINK_STATUS,
  PROFESSIONAL_STATUS,
  PROFESSIONAL_TYPE,
  WORK_MODALITY,
  label,
} from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import {
  Professional,
  ProfessionalLinkStatus,
  ProfessionalOrganizationLinkDetail,
} from './professionals.models';
import { ProfessionalsService } from './professionals.service';

/**
 * Ficha del profesional.
 *
 * La tabla de vínculos es la parte delicada: desactivar uno retira a esa
 * persona de la agenda del centro, y esa consecuencia se nombra en la
 * confirmación en vez de preguntar «¿estás seguro?». Quien confirma tiene que
 * poder leer qué deja de funcionar sin reconstruirlo de memoria.
 */
@Component({
  selector: 'medsys-professional-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    Skeleton,
    ConfirmDialog,
    Notice,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './professional-detail-page.html',
})
export class ProfessionalDetailPage {
  readonly professionalId = input.required<string>();

  private readonly professionals = inject(ProfessionalsService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly professionalStatuses = PROFESSIONAL_STATUS;
  protected readonly linkStatuses = PROFESSIONAL_LINK_STATUS;
  protected readonly canManage = computed(() => can.manageProfessionals(this.session.roles()));

  private readonly id = computed<string | null>(() => this.professionalId() ?? null);

  protected readonly professional = this.professionals.professionalResource(this.id);
  protected readonly specialties = this.professionals.specialtiesResource();

  private readonly specialtyNames = computed(
    () => new Map((this.specialties.value() ?? []).map((item) => [item.code, item.name])),
  );

  /** Vínculo sobre el que se está confirmando la activación o la baja. */
  protected readonly changing = signal<ProfessionalOrganizationLinkDetail | null>(null);
  protected readonly actionPending = signal(false);
  protected readonly actionFailure = signal<unknown>(null);

  protected readonly crumbs = computed(() => [
    { label: 'Profesionales', link: '/profesionales' },
    { label: this.professional.value()?.fullName ?? 'Profesional' },
  ]);

  protected readonly actionErrorMessage = computed(() => {
    const failure = this.actionFailure();
    return failure === null ? null : describeFailure(failure).message;
  });

  /** La principal primero: es la que identifica al profesional en la agenda. */
  protected readonly orderedSpecialties = computed(() => {
    const items = [...(this.professional.value()?.specialties ?? [])];
    return items.sort((a, b) => Number(b.primary) - Number(a.primary));
  });

  protected readonly links = computed<readonly ProfessionalOrganizationLinkDetail[]>(
    () => this.professional.value()?.organizations ?? [],
  );

  protected typeLabel(person: Professional): string {
    return label(PROFESSIONAL_TYPE, person.professionalType);
  }

  protected modalityLabel(link: ProfessionalOrganizationLinkDetail): string {
    return label(WORK_MODALITY, link.modality);
  }

  protected specialtyName(code: string): string {
    return this.specialtyNames().get(code) ?? code;
  }

  /** Cierto para el centro en el que se está trabajando ahora mismo. */
  protected isThisCentre(link: ProfessionalOrganizationLinkDetail): boolean {
    return link.organizationId === this.professionals.organizationId();
  }

  protected isActive(link: ProfessionalOrganizationLinkDetail): boolean {
    return link.status === 'ACTIVE';
  }

  protected ask(link: ProfessionalOrganizationLinkDetail): void {
    this.actionFailure.set(null);
    this.changing.set(link);
  }

  protected confirmHeading(): string {
    const link = this.changing();
    return link !== null && this.isActive(link)
      ? 'Desactivar el vínculo con el centro'
      : 'Reactivar el vínculo con el centro';
  }

  protected confirmLabel(): string {
    const link = this.changing();
    return link !== null && this.isActive(link) ? 'Desactivar vínculo' : 'Reactivar vínculo';
  }

  /**
   * La descripción nombra la consecuencia concreta y también lo que **no**
   * pasa: quien desactiva a un profesional casi siempre teme haber cancelado
   * la agenda de la semana, y esa duda es la que hay que resolver aquí.
   */
  protected confirmDescription(): string {
    const link = this.changing();
    const name = this.professional.value()?.fullName ?? 'El profesional';
    if (link === null) {
      return '';
    }
    return this.isActive(link)
      ? `${name} dejará de aparecer en la agenda de este centro y no se le podrán asignar citas nuevas. Las citas ya agendadas no se cancelan: siguen en la agenda y hay que atenderlas o reprogramarlas una por una.`
      : `${name} volverá a aparecer en la agenda de este centro y se le podrán asignar citas otra vez, con la misma modalidad y comisión que tenía el vínculo.`;
  }

  protected async apply(): Promise<void> {
    const link = this.changing();
    const id = this.id();
    if (link === null || id === null) {
      return;
    }
    // Se suspende y no se termina: SUSPENDED es el estado reversible, que es
    // justo lo que ofrece este botón. Ver `setLinkStatus`.
    const next: ProfessionalLinkStatus = this.isActive(link) ? 'SUSPENDED' : 'ACTIVE';
    this.actionPending.set(true);
    this.actionFailure.set(null);
    try {
      await this.professionals.setLinkStatus(id, link.id, next);
      this.toasts.notify(
        next === 'ACTIVE' ? 'El vínculo quedó activo.' : 'El vínculo quedó desactivado.',
      );
      this.changing.set(null);
      this.professional.reload();
    } catch (failure) {
      this.actionFailure.set(failure);
    } finally {
      this.actionPending.set(false);
    }
  }
}
