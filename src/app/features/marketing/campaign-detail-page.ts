import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  CAMPAIGN_CHANNEL,
  CAMPAIGN_STATUS,
  CAMPAIGN_TYPE,
  RECIPIENT_STATUS,
  label,
  options,
} from '../../core/labels/labels';
import {
  CampaignStatus,
  allowsAudienceRefresh,
  campaignTone,
  campaignTransitions,
  recipientTone,
} from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon, IconName } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { MarketingService } from './marketing.service';
import { Campaign, MaterializedAudience } from './marketing.models';

/** Acción del ciclo de vida, con el verbo que la nombra y su consecuencia real. */
interface LifecycleAction {
  readonly status: CampaignStatus;
  readonly label: string;
  readonly icon: IconName;
  readonly primary: boolean;
  readonly confirm: string | null;
}

/**
 * Jerarquía: lo primero es en qué estado está la campaña y qué se puede hacer con
 * ella; después, a cuánta gente llegó.
 *
 * Las acciones que se ofrecen salen de la máquina de estados del servicio. Un
 * destino imposible no se muestra deshabilitado: no se muestra, para que nadie
 * provoque un 422 pulsando lo que la pantalla le ofrecía.
 */
@Component({
  selector: 'medsys-campaign-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    Select,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Notice,
    Pager,
    Skeleton,
    TableSkeleton,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  templateUrl: './campaign-detail-page.html',
})
export class CampaignDetailPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaignStatuses = CAMPAIGN_STATUS;
  protected readonly campaignTypes = CAMPAIGN_TYPE;
  protected readonly channels = CAMPAIGN_CHANNEL;
  protected readonly recipientStatuses = RECIPIENT_STATUS;
  protected readonly campaignTones = campaignTone;
  protected readonly recipientTones = recipientTone;
  protected readonly recipientStatusOptions = options(RECIPIENT_STATUS);

  protected readonly canManage = computed(() => can.manageCampaigns(this.session.permissions()));

  protected readonly campaignId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('campaignId'))),
    { initialValue: null },
  );

  protected readonly campaign = this.marketing.campaignResource(this.campaignId);
  protected readonly performance = this.marketing.performanceResource(this.campaignId);

  protected readonly recipientPage = signal(0);
  protected readonly recipientStatus = signal<string | null>(null);
  protected readonly recipients = this.marketing.recipientsResource(
    this.campaignId,
    this.recipientStatus,
    this.recipientPage,
  );

  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly lastAudience = signal<MaterializedAudience | null>(null);
  protected readonly confirming = signal<LifecycleAction | null>(null);

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  /** Transiciones válidas desde el estado actual, ya traducidas a acciones. */
  protected readonly actions = computed<readonly LifecycleAction[]>(() => {
    const current = this.campaign.value();
    if (current === undefined || !this.canManage()) {
      return [];
    }
    const allowed = campaignTransitions(current.status as CampaignStatus);
    const catalog: Record<string, LifecycleAction> = {
      SCHEDULED: {
        status: 'SCHEDULED',
        label: 'Programar',
        icon: 'clock',
        primary: false,
        confirm: null,
      },
      RUNNING: {
        status: 'RUNNING',
        label: current.status === 'PAUSED' ? 'Reanudar' : 'Lanzar campaña',
        icon: 'megaphone',
        primary: true,
        confirm:
          current.status === 'PAUSED'
            ? null
            : current.channel === 'EMAIL'
              ? 'Al lanzarla, el backend encolará los correos y los enviará por SMTP. Cada destinatario mostrará el resultado y la audiencia ya no se podrá recalcular.'
              : 'Al lanzarla se publica el evento «marketing.campana» para iniciar la entrega. La audiencia ya no se podrá recalcular.',
      },
      PAUSED: {
        status: 'PAUSED',
        label: 'Pausar',
        icon: 'power',
        primary: false,
        confirm: null,
      },
      FINISHED: {
        status: 'FINISHED',
        label: 'Finalizar',
        icon: 'check-circle',
        primary: false,
        confirm: 'Una campaña finalizada no vuelve a ejecutarse.',
      },
      CANCELLED: {
        status: 'CANCELLED',
        label: 'Cancelar campaña',
        icon: 'ban',
        primary: false,
        confirm: 'Una campaña cancelada no vuelve a ejecutarse.',
      },
    };
    return allowed.map((status) => catalog[status]).filter((action) => action !== undefined);
  });

  /** La audiencia solo se congela antes de salir; después queda fija por auditoría. */
  protected readonly canMaterialize = computed(() => {
    const current = this.campaign.value();
    return (
      current !== undefined &&
      this.canManage() &&
      allowsAudienceRefresh(current.status as CampaignStatus)
    );
  });

  /** Lanzar exige audiencia: sin destinatarios el servicio responde 422. */
  protected readonly launchBlocked = computed(() => {
    const current = this.campaign.value();
    return current !== undefined && current.totalRecipients === 0;
  });

  protected readonly channelLabel = computed(() =>
    label(CAMPAIGN_CHANNEL, this.campaign.value()?.channel),
  );

  protected onRecipientStatusChange(value: string): void {
    this.recipientPage.set(0);
    this.recipientStatus.set(value === '' ? null : value);
  }

  protected async materialize(): Promise<void> {
    const id = this.campaignId();
    if (id === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      const audience = await this.marketing.materializeAudience(id);
      this.lastAudience.set(audience);
      this.toasts.notify(
        `Audiencia congelada: ${audience.reachable} destinatario(s), ` +
          `${audience.excludedOptOut} excluido(s) por opt-out` +
          (audience.excludedNoDestination > 0
            ? ` y ${audience.excludedNoDestination} sin dirección de entrega.`
            : '.'),
      );
      this.campaign.reload();
      this.recipients.reload();
      this.performance.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected requestAction(action: LifecycleAction): void {
    if (action.confirm === null) {
      void this.runAction(action);
      return;
    }
    this.confirming.set(action);
  }

  protected async runAction(action: LifecycleAction): Promise<void> {
    const id = this.campaignId();
    if (id === null) {
      return;
    }
    this.confirming.set(null);
    this.pending.set(true);
    this.failure.set(null);
    try {
      const updated = await this.transition(id, action.status);
      this.toasts.notify(
        `«${updated.name}» quedó en estado ${label(CAMPAIGN_STATUS, updated.status).toLowerCase()}.`,
      );
      this.campaign.reload();
      this.performance.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  private transition(id: string, status: CampaignStatus): Promise<Campaign> {
    switch (status) {
      case 'SCHEDULED':
        return this.marketing.scheduleCampaign(id);
      case 'RUNNING':
        return this.marketing.launchCampaign(id);
      case 'PAUSED':
        return this.marketing.pauseCampaign(id);
      case 'FINISHED':
        return this.marketing.finishCampaign(id);
      default:
        return this.marketing.cancelCampaign(id);
    }
  }

  /** Porcentaje ya formateado; el servicio devuelve `null` cuando el denominador es cero. */
  protected rate(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${value}%`;
  }
}
