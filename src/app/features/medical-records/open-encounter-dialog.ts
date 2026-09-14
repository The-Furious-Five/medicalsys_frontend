import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { describeFailure } from '../../core/http/api-error';
import { ENCOUNTER_TYPE, options } from '../../core/labels/labels';
import { ToastService } from '../../core/toast/toast.service';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { Select, SelectOption } from '../../shared/select';
import { PatientPicker } from '../patients/patient-picker';
import { TenancyService } from '../tenancy/tenancy.service';
import { RecordsService } from './records.service';

/**
 * Abrir un encuentro necesita paciente, profesional y sede. El profesional es
 * quien está usando la aplicación, así que se toma de la sesión y no se
 * pregunta: pedirlo sería exigir un dato que el sistema ya conoce.
 */
@Component({
  selector: 'medsys-open-encounter-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, PatientPicker, Select],
  template: `
    <medsys-dialog
      [open]="open()"
      [width]="500"
      heading="Abrir encuentro clínico"
      description="Se abre en borrador. Podrás escribir y corregir hasta que lo firmes."
      (closed)="closed.emit()"
    >
      <div class="stack gap-4">
        @if (errorMessage(); as message) {
          <medsys-notice tone="err">{{ message }}</medsys-notice>
        }
        @if (!branches.isLoading() && activeBranchList().length === 0) {
          <medsys-notice tone="warn" heading="No hay sucursales activas">
            Un encuentro se registra siempre en una sede. Un administrador debe activar al menos una
            sucursal en la sección Organización.
          </medsys-notice>
        }

        <div class="field">
          <span class="field-label">Paciente</span>
          <medsys-patient-picker
            [patientId]="patientId()"
            (patientIdChange)="patientId.set($event)"
            [autoFocus]="true"
            placeholder="Buscar por nombre o documento"
          />
        </div>

        <div class="field">
          <label class="field-label" for="encounter-type">Tipo de encuentro</label>
          <medsys-select
            [controlId]="'encounter-type'"
            [options]="types"
            [allowEmpty]="false"
            [value]="type()"
            (valueChange)="type.set($event)"
          />
        </div>

        <div class="field">
          <label class="field-label" for="encounter-branch">Sucursal</label>
          <medsys-select
            [controlId]="'encounter-branch'"
            [options]="branchOptions()"
            placeholder="Elige una sucursal"
            [value]="branchId()"
            (valueChange)="branchId.set($event)"
          />
        </div>

        <p class="field-hint">El encuentro queda registrado a nombre de {{ userName() }}.</p>
      </div>

      <ng-container dialogFooter>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!ready() || pending()"
          (click)="openEncounter()"
        >
          Abrir encuentro
        </button>
      </ng-container>
    </medsys-dialog>
  `,
})
export class OpenEncounterDialog {
  readonly open = input(false);
  readonly presetPatientId = input<string | null>(null);
  readonly closed = output<void>();

  private readonly records = inject(RecordsService);
  private readonly tenancy = inject(TenancyService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly types = options(ENCOUNTER_TYPE);
  private readonly activeBranches = signal<string | null>('ACTIVE');
  protected readonly branches = this.tenancy.branchesResource(this.activeBranches);
  protected readonly activeBranchList = computed(() => this.branches.value()?.content ?? []);
  protected readonly branchOptions = computed<readonly SelectOption[]>(() =>
    this.activeBranchList().map((branch) => ({ value: branch.id, label: branch.name })),
  );

  protected readonly patientId = signal<string | null>(null);
  protected readonly branchId = signal('');
  protected readonly type = signal('INITIAL_CONSULTATION');
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly userName = computed(() => this.session.user()?.fullName ?? 'tu cuenta');
  protected readonly ready = computed(() => this.patientId() !== null && this.branchId() !== '');
  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.patientId.set(this.presetPatientId());
        this.type.set('INITIAL_CONSULTATION');
        this.failure.set(null);
      }
    });

    // Con una sola sede activa no tiene sentido preguntar cuál: se preselecciona
    // la casa matriz, o la primera si no la hubiera.
    effect(() => {
      const branches = this.activeBranchList();
      if (this.open() && this.branchId() === '' && branches.length > 0) {
        this.branchId.set((branches.find((branch) => branch.headquarters) ?? branches[0]).id);
      }
    });
  }

  protected async openEncounter(): Promise<void> {
    if (!this.ready()) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      const encounter = await this.records.openEncounter({
        patientId: this.patientId()!,
        professionalId: this.session.user()!.publicId,
        branchId: this.branchId(),
        type: this.type(),
      });
      this.toasts.notify('Encuentro abierto en borrador. Se guarda solo mientras escribes.');
      this.closed.emit();
      await this.router.navigate(['/encuentros', encounter.id]);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
