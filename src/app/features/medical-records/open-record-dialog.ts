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
import { describeFailure } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast.service';
import { Dialog } from '../../shared/dialog';
import { Notice } from '../../shared/notice';
import { PatientPicker } from '../patients/patient-picker';
import { TenancyService } from '../tenancy/tenancy.service';
import { RecordsService } from './records.service';

/**
 * Abrir expediente es idempotente en el backend: si la persona ya tiene uno, se
 * devuelve el existente. La interfaz lo dice antes de que el usuario dude si va
 * a duplicar algo.
 */
@Component({
  selector: 'medsys-open-record-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Notice, PatientPicker],
  template: `
    <medsys-dialog
      [open]="open()"
      [width]="500"
      heading="Abrir expediente"
      description="Si la persona ya tiene expediente en este centro, se abre el que ya existe en vez de crear uno nuevo."
      (closed)="closed.emit()"
    >
      <div class="stack gap-4">
        @if (errorMessage(); as message) {
          <medsys-notice tone="err">{{ message }}</medsys-notice>
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
          <label class="field-label" for="record-branch">
            Sucursal de apertura <span class="field-optional">(opcional)</span>
          </label>
          <span class="select-wrap">
            <select
              id="record-branch"
              class="select"
              [value]="branchId()"
              (change)="branchId.set($any($event.target).value)"
            >
              <option value="">Sin especificar</option>
              @for (branch of branches.value()?.content ?? []; track branch.id) {
                <option [value]="branch.id">{{ branch.name }}</option>
              }
            </select>
          </span>
          <span class="field-hint">Sede en la que se atiende por primera vez a la persona.</span>
        </div>
      </div>

      <ng-container dialogFooter>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="patientId() === null || pending()"
          (click)="openRecord()"
        >
          Abrir expediente
        </button>
      </ng-container>
    </medsys-dialog>
  `,
})
export class OpenRecordDialog {
  readonly open = input(false);
  readonly presetPatientId = input<string | null>(null);
  readonly closed = output<void>();

  private readonly records = inject(RecordsService);
  private readonly tenancy = inject(TenancyService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  private readonly activeBranches = signal<string | null>('ACTIVE');
  protected readonly branches = this.tenancy.branchesResource(this.activeBranches);

  protected readonly patientId = signal<string | null>(null);
  protected readonly branchId = signal('');
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.patientId.set(this.presetPatientId());
        this.branchId.set('');
        this.failure.set(null);
      }
    });
  }

  protected async openRecord(): Promise<void> {
    const patientId = this.patientId();
    if (patientId === null) {
      return;
    }
    this.pending.set(true);
    this.failure.set(null);
    try {
      const record = await this.records.openRecord(patientId, this.branchId() || null);
      this.toasts.notify(`Expediente ${record.recordNumber} listo.`);
      this.closed.emit();
      await this.router.navigate(['/expedientes', record.id]);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
