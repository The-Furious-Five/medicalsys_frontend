import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FORMAT_PIPES } from '../../../core/format/format.pipe';
import {
  ALLERGY_SEVERITY,
  ALLERGY_TYPE,
  BACKGROUND_TYPE,
  DOCUMENT_TYPE_SHORT,
  SEX,
  label,
} from '../../../core/labels/labels';
import { Icon } from '../../../core/ui/icon';
import { Skeleton } from '../../../shared/skeleton';
import { PatientsService } from '../../patients/patients.service';
import { RecordsService } from '../records.service';
import { Allergy } from '../records.models';

/**
 * Contexto persistente del paciente durante el encuentro.
 *
 * Las alergias van primero y con el mayor peso visual de la columna: es el dato
 * que, si se pasa por alto, causa daño. Lo demás se ordena por frecuencia de
 * consulta, no por jerarquía del modelo de datos.
 */
@Component({
  selector: 'medsys-patient-context',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Skeleton, ...FORMAT_PIPES],
  templateUrl: './patient-context.html',
})
export class PatientContext {
  readonly patientId = input.required<string>();
  readonly recordId = input.required<string>();

  private readonly patients = inject(PatientsService);
  private readonly records = inject(RecordsService);

  private readonly patientIdSignal = computed<string | null>(() => this.patientId());
  private readonly recordIdSignal = computed<string | null>(() => this.recordId());

  protected readonly patient = this.patients.patientResource(this.patientIdSignal);
  protected readonly allergies = this.records.allergiesResource(this.recordIdSignal);
  protected readonly backgrounds = this.records.backgroundsResource(this.recordIdSignal);

  protected readonly activeAllergies = computed(() =>
    (this.allergies.value() ?? []).filter((allergy) => allergy.status === 'ACTIVE'),
  );

  protected readonly activeBackgrounds = computed(() =>
    (this.backgrounds.value() ?? []).filter((background) => background.active),
  );

  protected readonly visibleBackgrounds = computed(() => this.activeBackgrounds().slice(0, 6));

  protected documentLabel(type: string): string {
    return label(DOCUMENT_TYPE_SHORT, type);
  }

  protected sexLabel(sex: string | null): string {
    return label(SEX, sex);
  }

  protected allergyTypeLabel(allergy: Allergy): string {
    return label(ALLERGY_TYPE, allergy.type);
  }

  protected severityLabel(severity: string | null): string {
    return label(ALLERGY_SEVERITY, severity);
  }

  /** Grave y anafilaxia se marcan en rojo; el resto, en ámbar. */
  protected severityTone(severity: string | null): string {
    return severity === 'SEVERE' || severity === 'ANAPHYLAXIS' ? 'err' : 'warn';
  }

  protected backgroundTypeLabel(type: string): string {
    return label(BACKGROUND_TYPE, type);
  }
}
