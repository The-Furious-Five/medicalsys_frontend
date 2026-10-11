import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { LOYALTY_MOVEMENT_TYPE, label } from '../../core/labels/labels';
import { loyaltyMovementTone } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Pager } from '../../shared/pager';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { TableSkeleton } from '../../shared/table-skeleton';
import { PatientPicker } from '../patients/patient-picker';
import { MarketingService } from './marketing.service';
import { LoyaltyMovementInput } from './marketing.models';
import { NumberField } from '../../shared/number-field';

/**
 * Fidelización: programas del centro y el libro mayor de puntos de un paciente.
 *
 * El saldo no se guarda: se deriva sumando los asientos. Cuesta un poco más que
 * un contador y compensa — cuando alguien reclama que le faltan puntos, la
 * respuesta es la lista de movimientos con su procedencia, no un número que
 * cualquiera pudo haber corregido.
 *
 * No hay forma de acumular a mano. La acumulación llega por evento desde
 * facturación con su clave de idempotencia; permitirla aquí abriría la puerta a
 * otorgar dos veces los puntos de una misma factura, y el servicio la rechaza.
 */
@Component({
  selector: 'medsys-loyalty-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    PatientPicker,
    Dialog,
    Select,
    StatusChip,
    EmptyState,
    ErrorState,
    Notice,
    Pager,
    Skeleton,
    TableSkeleton,
    Icon,
    ReactiveFormsModule,
    ...FORMAT_PIPES,
    NumberField,
  ],
  templateUrl: './loyalty-page.html',
})
export class LoyaltyPage {
  private readonly marketing = inject(MarketingService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly movementTypes = LOYALTY_MOVEMENT_TYPE;
  protected readonly movementTones = loyaltyMovementTone;

  /* La acumulación se omite a propósito: no se registra a mano. */
  protected readonly manualTypes = [
    { value: 'REDEMPTION', label: 'Canje de puntos' },
    { value: 'MANUAL_ADJUSTMENT', label: 'Ajuste manual' },
    { value: 'REFERRAL_BONUS', label: 'Bonificación por referido' },
    { value: 'EXPIRATION', label: 'Expiración' },
  ];

  protected readonly canManage = computed(() => can.manageLoyalty(this.session.permissions()));
  protected readonly canRegister = computed(() =>
    can.registerLoyaltyMovement(this.session.permissions()),
  );

  protected readonly programs = this.marketing.loyaltyProgramsResource();

  protected readonly patientId = signal<string | null>(null);
  protected readonly movementPage = signal(0);
  protected readonly balance = this.marketing.balanceResource(this.patientId);
  protected readonly movements = this.marketing.movementsResource(
    this.patientId,
    this.movementPage,
  );

  protected readonly programSheetOpen = signal(false);
  protected readonly movementSheetOpen = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly programForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    pointsPerBob: ['1', [Validators.required, Validators.min(0)]],
    bobPerPoint: ['0.01', [Validators.required, Validators.min(0)]],
    pointsValidityMonths: ['12'],
  });

  protected readonly movementForm = this.fb.nonNullable.group({
    type: ['REDEMPTION', [Validators.required]],
    points: ['', [Validators.required, Validators.min(1)]],
    reason: ['', [Validators.maxLength(250)]],
  });

  protected readonly hasActiveProgram = computed(() =>
    (this.programs.value() ?? []).some((program) => program.active),
  );

  protected readonly failureMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure);
  });

  /** El ajuste manual exige motivo: es lo único que lo distingue de un descuadre. */
  protected readonly movementRuleError = computed(() => {
    const raw = this.movementForm.getRawValue();
    return raw.type === 'MANUAL_ADJUSTMENT' && raw.reason.trim() === ''
      ? 'Un ajuste manual necesita un motivo.'
      : null;
  });

  protected onPatientChange(patientId: string | null): void {
    this.movementPage.set(0);
    this.patientId.set(patientId);
  }

  protected movementLabel(type: string): string {
    return label(LOYALTY_MOVEMENT_TYPE, type);
  }

  protected async createProgram(): Promise<void> {
    this.programForm.markAllAsTouched();
    if (this.programForm.invalid) {
      return;
    }
    const raw = this.programForm.getRawValue();
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.marketing.createLoyaltyProgram({
        name: raw.name.trim(),
        pointsPerBob: Number(raw.pointsPerBob),
        bobPerPoint: Number(raw.bobPerPoint),
        pointsValidityMonths:
          raw.pointsValidityMonths === '' ? null : Number(raw.pointsValidityMonths),
      });
      this.toasts.notify(`Programa «${raw.name}» creado.`);
      this.programSheetOpen.set(false);
      this.programs.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }

  protected async deactivateProgram(programId: string, name: string): Promise<void> {
    try {
      await this.marketing.deactivateLoyaltyProgram(programId);
      this.toasts.notify(`Programa «${name}» desactivado. Sus asientos se conservan.`);
      this.programs.reload();
    } catch {
      this.toasts.notify('No se pudo desactivar el programa.', 'err');
    }
  }

  protected async registerMovement(): Promise<void> {
    this.movementForm.markAllAsTouched();
    const patientId = this.patientId();
    if (this.movementForm.invalid || this.movementRuleError() !== null || patientId === null) {
      return;
    }
    const raw = this.movementForm.getRawValue();

    this.pending.set(true);
    this.failure.set(null);
    try {
      const movement = await this.marketing.registerMovement({
        patientId,
        type: raw.type as LoyaltyMovementInput['type'],
        points: Number(raw.points),
        reason: raw.reason.trim() === '' ? null : raw.reason.trim(),
      });
      this.toasts.notify(
        `${this.movementLabel(movement.type)} registrado. Saldo: ${movement.resultingBalance} puntos.`,
      );
      this.movementSheetOpen.set(false);
      this.movementForm.reset({ type: 'REDEMPTION', points: '', reason: '' });
      this.balance.reload();
      this.movements.reload();
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
