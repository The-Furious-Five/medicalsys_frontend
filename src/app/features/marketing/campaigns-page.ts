import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { CAMPAIGN_STATUS, CAMPAIGN_TYPE, options } from '../../core/labels/labels';
import { campaignTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { MarketingService } from './marketing.service';

/**
 * Jerarquía: de una campaña se busca en qué estado está y a cuánta gente llegó.
 * El estado manda porque decide qué se puede hacer con ella a continuación.
 */
@Component({
  selector: 'medsys-campaigns-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    Select,
    EmptyState,
    ErrorState,
    Pager,
    TableSkeleton,
    Icon,
    RouterLink,
    ...FORMAT_PIPES,
  ],
  templateUrl: './campaigns-page.html',
})
export class CampaignsPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);

  protected readonly campaignStatuses = CAMPAIGN_STATUS;
  protected readonly campaignTypes = CAMPAIGN_TYPE;
  protected readonly campaignTones = campaignTone;
  protected readonly statusOptions = options(CAMPAIGN_STATUS);

  protected readonly canManage = computed(() => can.manageMarketing(this.session.roles()));

  protected readonly page = signal(0);
  protected readonly status = signal<string | null>(null);
  protected readonly campaigns = this.marketing.campaignsResource(this.status, this.page);

  protected onStatusChange(value: string): void {
    this.page.set(0);
    this.status.set(value === '' ? null : value);
  }

  protected open(campaignId: string): void {
    void this.router.navigate(['/campanas', campaignId]);
  }

  protected onRowKey(event: KeyboardEvent, campaignId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open(campaignId);
    }
  }
}
