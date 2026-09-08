import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
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
import { PatientActivity } from './marketing.models';

/**
 * Actividad comercial y exclusión de comunicaciones.
 *
 * Conviene mirar las columnas de esta tabla y notar lo que no está: hay fechas,
 * contadores e importes, y ni un solo campo que diga por qué el paciente vino.
 * Es toda la historia que marketing conoce, y la proyección se alimenta de
 * eventos de agenda y de facturación.
 *
 * El opt-out se ejerce aquí, contra el servicio que manda la publicidad, y no en
 * la ficha del paciente: así sigue funcionando aunque ms-pacientes esté caído, y
 * se aplica en el momento en que se congela una audiencia.
 */
@Component({
  selector: 'medsys-activity-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    ConfirmDialog,
    EmptyState,
    ErrorState,
    Notice,
    Pager,
    TableSkeleton,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './activity-page.html',
})
export class ActivityPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);

  protected readonly canManageOptOut = computed(() => can.manageOptOut(this.session.roles()));

  protected readonly page = signal(0);
  protected readonly activity = this.marketing.activityResource(this.page);

  protected readonly confirming = signal<PatientActivity | null>(null);
  protected readonly pending = signal(false);

  protected request(patient: PatientActivity): void {
    if (patient.marketingOptOut) {
      void this.setOptOut(patient, false);
      return;
    }
    // Excluir es la acción con consecuencia: se confirma nombrando a la persona.
    this.confirming.set(patient);
  }

  protected async confirmOptOut(): Promise<void> {
    const patient = this.confirming();
    if (patient === null) {
      return;
    }
    this.pending.set(true);
    await this.setOptOut(patient, true);
    this.pending.set(false);
    this.confirming.set(null);
  }

  private async setOptOut(patient: PatientActivity, optOut: boolean): Promise<void> {
    try {
      await this.marketing.setOptOut(patient.patientId, optOut);
      this.toasts.notify(
        optOut
          ? `${patient.fullName ?? 'El paciente'} ya no recibirá comunicaciones comerciales.`
          : `${patient.fullName ?? 'El paciente'} vuelve a estar disponible para campañas.`,
      );
      this.activity.reload();
    } catch {
      this.toasts.notify('No se pudo cambiar la preferencia del paciente.', 'err');
    }
  }
}
