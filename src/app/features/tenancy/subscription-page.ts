import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatBytes, formatNumber } from '../../core/format/format';
import { BILLING_CYCLE, SUBSCRIPTION_STATUS, USAGE_METRIC, label } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { TenancyService } from './tenancy.service';
import { PlanUsage } from './tenancy.models';

/**
 * Jerarquía: el plan contratado es un hecho; el consumo es un riesgo. Por eso
 * el consumo va arriba, con barras, y el detalle del contrato debajo.
 */
@Component({
  selector: 'medsys-subscription-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, StatusChip, ErrorState, Notice, Skeleton, Icon, ...FORMAT_PIPES],
  templateUrl: './subscription-page.html',
})
export class SubscriptionPage {
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);

  protected readonly subscriptionStatuses = SUBSCRIPTION_STATUS;
  protected readonly showsUsage = computed(() => can.viewUsage(this.session.roles()));

  protected readonly subscription = this.tenancy.subscriptionResource();
  protected readonly usage = this.tenancy.usageResource();

  protected readonly exceeded = computed(() =>
    (this.usage.value() ?? []).filter((metric) => metric.exceeded),
  );

  protected readonly exceededNames = computed(() =>
    this.exceeded()
      .map((metric) => label(USAGE_METRIC, metric.metric).toLowerCase())
      .join(' y '),
  );

  protected metricLabel(metric: PlanUsage): string {
    return label(USAGE_METRIC, metric.metric);
  }

  protected currentValue(metric: PlanUsage): string {
    return metric.metric === 'STORAGE_BYTES'
      ? formatBytes(metric.currentValue)
      : formatNumber(metric.currentValue);
  }

  protected limitValue(metric: PlanUsage): string | null {
    if (metric.limit === null) {
      return null;
    }
    return metric.metric === 'STORAGE_BYTES'
      ? formatBytes(metric.limit)
      : formatNumber(metric.limit);
  }

  protected remainingValue(metric: PlanUsage): string {
    return metric.metric === 'STORAGE_BYTES'
      ? formatBytes(metric.remaining)
      : formatNumber(metric.remaining);
  }

  /** Porcentaje consumido. Un límite nulo significa ilimitado y no se mide. */
  protected percent(metric: PlanUsage): number {
    const cap = metric.limit;
    if (cap === null || cap === 0) {
      return 0;
    }
    return Math.min(100, Math.round((metric.currentValue / cap) * 100));
  }

  protected meterTone(metric: PlanUsage): string {
    if (metric.limit === null) return 'neutral';
    if (metric.exceeded) return 'err';
    return this.percent(metric) >= 80 ? 'warn' : 'ok';
  }

  protected cycleLabel(cycle: string): string {
    return label(BILLING_CYCLE, cycle).toLowerCase();
  }

  protected planLimit(value: number | null, suffix = ''): string {
    return value === null ? 'Sin límite' : `${formatNumber(value)}${suffix}`;
  }
}
