import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { DISCOUNT_TYPE } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { MarketingService } from './marketing.service';
import { Promotion } from './marketing.models';
import { PromotionSheet } from './promotion-sheet';
import { ValidateCouponDialog } from './validate-coupon-dialog';

/**
 * Jerarquía: de un cupón importan tres cosas en este orden — si sirve hoy, cuánto
 * descuenta y cuánto cupo le queda. El código identifica y por eso va primero en
 * la fila, en monoespaciada: se lee en voz alta y se teclea.
 */
@Component({
  selector: 'medsys-promotions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    PromotionSheet,
    ValidateCouponDialog,
    StatusChip,
    EmptyState,
    ErrorState,
    Pager,
    TableSkeleton,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './promotions-page.html',
})
export class PromotionsPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly discountTypes = DISCOUNT_TYPE;
  protected readonly canManage = computed(() => can.manageMarketing(this.session.roles()));
  protected readonly canValidate = computed(() => can.redeemCoupons(this.session.roles()));

  protected readonly page = signal(0);
  private readonly active = signal<boolean | null>(null);
  protected readonly promotions = this.marketing.promotionsResource(this.active, this.page);

  protected readonly sheetOpen = signal(false);
  protected readonly validatorOpen = signal(false);
  protected readonly validatingCode = signal<string | null>(null);

  protected onSaved(): void {
    this.sheetOpen.set(false);
    this.promotions.reload();
  }

  protected checkCoupon(code: string | null): void {
    this.validatingCode.set(code);
    this.validatorOpen.set(true);
  }

  /** Un cupón vigente es el que está activo y dentro de su ventana de fechas. */
  protected isLive(promotion: Promotion): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return promotion.active && promotion.validFrom <= today && promotion.validUntil >= today;
  }

  protected remaining(promotion: Promotion): string {
    if (promotion.maxRedemptions === null) {
      return `${promotion.currentRedemptions} usos · sin límite`;
    }
    return `${promotion.currentRedemptions} de ${promotion.maxRedemptions}`;
  }

  protected discountText(promotion: Promotion): string {
    switch (promotion.discountType) {
      case 'PERCENTAGE':
        return `${promotion.value} %`;
      case 'FREE_SERVICE':
        return 'Prestación gratis';
      default:
        return `Bs ${promotion.value}`;
    }
  }

  protected async deactivate(promotion: Promotion): Promise<void> {
    try {
      await this.marketing.deactivatePromotion(promotion.id);
      this.toasts.notify(`Cupón ${promotion.couponCode} desactivado.`);
      this.promotions.reload();
    } catch {
      this.toasts.notify('No se pudo desactivar el cupón.', 'err');
    }
  }
}
