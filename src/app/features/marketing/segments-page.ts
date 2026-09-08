import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { SEX, label } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { TableSkeleton } from '../../shared/table-skeleton';
import { MarketingService } from './marketing.service';
import { Segment } from './marketing.models';
import { SegmentSheet } from './segment-sheet';
import { describeCriteria } from './segment-criteria';

/**
 * Jerarquía: de un segmento interesa a cuánta gente alcanza y con qué criterio.
 * El nombre identifica; el tamaño es lo que decide si sirve para una campaña.
 */
@Component({
  selector: 'medsys-segments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    SegmentSheet,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Notice,
    Pager,
    TableSkeleton,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './segments-page.html',
})
export class SegmentsPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly canManage = computed(() => can.manageMarketing(this.session.roles()));

  protected readonly page = signal(0);
  private readonly active = signal<boolean | null>(null);
  protected readonly segments = this.marketing.segmentsResource(this.active, this.page);

  protected readonly sheetOpen = signal(false);
  protected readonly editing = signal<Segment | null>(null);
  protected readonly deleting = signal<Segment | null>(null);
  protected readonly pending = signal(false);
  protected readonly evaluatingId = signal<string | null>(null);

  protected readonly criteriaText = (segment: Segment): string =>
    describeCriteria(segment.criteria, (value) => label(SEX, value));

  protected create(): void {
    this.editing.set(null);
    this.sheetOpen.set(true);
  }

  protected edit(segment: Segment): void {
    this.editing.set(segment);
    this.sheetOpen.set(true);
  }

  protected onSaved(): void {
    this.sheetOpen.set(false);
    this.segments.reload();
  }

  /**
   * Reevaluar tiene sentido porque la audiencia se mueve sola: cada visita y cada
   * factura que llega por evento cambia la actividad del paciente, y con ella el
   * resultado de un criterio de reactivación.
   */
  protected async evaluate(segment: Segment): Promise<void> {
    this.evaluatingId.set(segment.id);
    try {
      const preview = await this.marketing.evaluateSegment(segment.id);
      this.toasts.notify(
        `«${segment.name}» alcanza ahora a ${preview.reachable} paciente(s); ` +
          `${preview.optedOut} excluido(s) por opt-out.`,
      );
      this.segments.reload();
    } catch {
      this.toasts.notify('No se pudo reevaluar el segmento.', 'err');
    } finally {
      this.evaluatingId.set(null);
    }
  }

  protected async deactivate(segment: Segment): Promise<void> {
    try {
      await this.marketing.deactivateSegment(segment.id);
      this.toasts.notify(`«${segment.name}» quedó desactivado.`);
      this.segments.reload();
    } catch {
      this.toasts.notify('No se pudo desactivar el segmento.', 'err');
    }
  }

  protected async confirmDelete(): Promise<void> {
    const segment = this.deleting();
    if (segment === null) {
      return;
    }
    this.pending.set(true);
    try {
      await this.marketing.deleteSegment(segment.id);
      this.toasts.notify(`Segmento «${segment.name}» eliminado.`);
      this.deleting.set(null);
      this.segments.reload();
    } catch (failure) {
      // El servicio responde 409 cuando alguna campaña lo referencia: borrarlo
      // dejaría sin explicación la audiencia de una campaña ya ejecutada.
      this.deleting.set(null);
      this.toasts.notify(
        failure instanceof Object && 'status' in failure && failure.status === 409
          ? 'No se puede eliminar: alguna campaña usa este segmento. Desactívalo en su lugar.'
          : 'No se pudo eliminar el segmento.',
        'warn',
      );
    } finally {
      this.pending.set(false);
    }
  }
}
