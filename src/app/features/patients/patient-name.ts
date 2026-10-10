import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { formatAge, formatDocument } from '../../core/format/format';
import { DOCUMENT_TYPE_SHORT, label } from '../../core/labels/labels';
import { Skeleton } from '../../shared/skeleton';
import { PatientsService } from './patients.service';
import { Patient } from './patients.models';

/**
 * Nombre del paciente a partir de su UUID.
 *
 * Historial y facturación solo guardan el identificador. Si ms-pacientes no
 * responde se nombra qué es el dato en vez de dejar un hexadecimal suelto, que
 * no le sirve a nadie en el mostrador, y el resto de la fila sigue siendo útil.
 */
@Component({
  selector: 'medsys-patient-name',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    @if (loading()) {
      <medsys-skeleton width="140px" height="14px" />
    } @else if (patient(); as person) {
      <span class="stack" style="gap: 1px">
        <span class="t-strong truncate">{{ person.fullName }}</span>
        @if (withDocument()) {
          <span class="t-micro t-num">{{ documentLine(person) }}</span>
        }
      </span>
    } @else {
      <span class="t-sec">Paciente sin identificar</span>
    }
  `,
})
export class PatientName {
  readonly patientId = input.required<string>();
  readonly withDocument = input(false);

  private readonly patients = inject(PatientsService);

  protected readonly patient = signal<Patient | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      const id = this.patientId();
      this.loading.set(true);
      this.patients.get(id).then(
        (person) => {
          this.patient.set(person);
          this.loading.set(false);
        },
        () => {
          this.patient.set(null);
          this.loading.set(false);
        },
      );
    });
  }

  protected documentLine(person: Patient): string {
    const document = formatDocument(person.documentNumber, person.documentComplement);
    return `${label(DOCUMENT_TYPE_SHORT, person.documentType)} ${document} · ${formatAge(person.birthDate)}`;
  }
}
