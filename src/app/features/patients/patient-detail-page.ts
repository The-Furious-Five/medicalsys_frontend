import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  DEPARTMENT,
  DOCUMENT_TYPE,
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPE,
  INVOICE_STATUS,
  PATIENT_STATUS,
  RECORD_STATUS,
  SEX,
  label,
} from '../../core/labels/labels';
import { encounterTone, invoiceTone, recordTone } from '../../core/state/state-machines';
import { Icon } from '../../core/ui/icon';
import { ErrorState } from '../../shared/error-state';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { BillingService } from '../billing/billing.service';
import { OpenEncounterDialog } from '../medical-records/open-encounter-dialog';
import { OpenRecordDialog } from '../medical-records/open-record-dialog';
import { RecordsService } from '../medical-records/records.service';
import { PatientsService } from './patients.service';
import { Patient } from './patients.models';

/**
 * Ficha del paciente: el punto donde convergen los tres módulos. Es una vista
 * de navegación —de aquí se salta al expediente, al encuentro o a la factura—
 * así que cada tarjeta muestra lo justo para decidir a dónde ir.
 */
@Component({
  selector: 'medsys-patient-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    Skeleton,
    RouterLink,
    Icon,
    OpenRecordDialog,
    OpenEncounterDialog,
    ...FORMAT_PIPES,
  ],
  templateUrl: './patient-detail-page.html',
})
export class PatientDetailPage {
  readonly patientId = input.required<string>();

  private readonly patients = inject(PatientsService);
  private readonly records = inject(RecordsService);
  private readonly billing = inject(BillingService);
  private readonly session = inject(AuthSession);

  protected readonly patientStatuses = PATIENT_STATUS;
  protected readonly recordStatuses = RECORD_STATUS;
  protected readonly recordTones = recordTone;
  protected readonly encounterStatuses = ENCOUNTER_STATUS;
  protected readonly encounterTones = encounterTone;
  protected readonly invoiceStatuses = INVOICE_STATUS;
  protected readonly invoiceTones = invoiceTone;

  private readonly id = computed<string | null>(() => this.patientId() ?? null);

  protected readonly patient = this.patients.patientResource(this.id);
  protected readonly record = this.records.recordByPatientResource(this.id);

  private readonly recordId = computed(() => this.record.value()?.id ?? null);
  private readonly encounterPage = signal(0);
  private readonly noStatus = signal<string | null>(null);

  protected readonly encounters = this.records.encountersResource(
    this.noStatus,
    this.encounterPage,
    this.recordId,
    5,
  );
  protected readonly invoices = this.billing.invoicesResource(this.id, signal(0), 5);

  protected readonly canOpenRecord = computed(() => can.openRecord(this.session.permissions()));
  protected readonly canOpenEncounter = computed(() =>
    can.openEncounter(this.session.permissions()),
  );
  protected readonly canViewInvoices = computed(() => can.viewInvoices(this.session.permissions()));

  /** Un 404 aquí no es un fallo: significa que la persona todavía no tiene
   *  expediente, que es lo normal antes de la primera atención. */
  protected readonly recordMissing = computed(() => {
    const failure = this.record.error();
    return failure instanceof HttpErrorResponse && failure.status === 404;
  });

  protected readonly openingRecord = signal(false);
  protected readonly openingEncounter = signal(false);

  protected readonly crumbs = computed(() => [
    { label: 'Pacientes', link: '/pacientes' },
    { label: this.patient.value()?.fullName ?? 'Paciente' },
  ]);

  protected readonly summary = computed(() => {
    const person = this.patient.value();
    if (person === undefined) {
      return null;
    }
    return `${label(DOCUMENT_TYPE, person.documentType)} ${person.documentNumber}${
      person.documentComplement ? ` ${person.documentComplement}` : ''
    }`;
  });

  protected sexLabel(person: Patient): string {
    return label(SEX, person.sex);
  }

  protected departmentLabel(person: Patient): string {
    return label(DEPARTMENT, person.department);
  }

  protected documentLabel(person: Patient): string {
    return label(DOCUMENT_TYPE, person.documentType);
  }

  protected encounterTypeLabel(type: string): string {
    return label(ENCOUNTER_TYPE, type);
  }
}
