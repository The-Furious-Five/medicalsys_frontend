import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import {
  ALLERGY_SEVERITY,
  ALLERGY_STATUS,
  ALLERGY_TYPE,
  BACKGROUND_TYPE,
  DOCUMENT_TYPE_SHORT,
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPE,
  RECORD_STATUS,
  label,
  options,
} from '../../core/labels/labels';
import { encounterTone, recordTone } from '../../core/state/state-machines';
import { formatAge, formatDate, formatDocument } from '../../core/format/format';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { DateField } from '../../shared/date-field';
import { Select } from '../../shared/select';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Dialog } from '../../shared/dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientsService } from '../patients/patients.service';
import { OpenEncounterDialog } from './open-encounter-dialog';
import { RecordsService } from './records.service';
import { Background } from './records.models';

type Tab = 'encuentros' | 'alergias' | 'antecedentes';

/**
 * Jerarquía: el expediente es el índice de una persona. Se entra a él para ir a
 * otro sitio — un encuentro, una alergia, un antecedente — así que se organiza
 * en pestañas y cada una es una lista corta y accionable, no un formulario.
 */
@Component({
  selector: 'medsys-record-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DateField,
    Select,
    PageHeader,
    StatusChip,
    ErrorState,
    EmptyState,
    Notice,
    Skeleton,
    Dialog,
    ConfirmDialog,
    OpenEncounterDialog,
    RouterLink,
    Icon,
    ...FORMAT_PIPES,
  ],
  templateUrl: './record-detail-page.html',
})
export class RecordDetailPage {
  readonly recordId = input.required<string>();

  private readonly records = inject(RecordsService);
  private readonly patients = inject(PatientsService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly recordStatuses = RECORD_STATUS;
  protected readonly recordTones = recordTone;
  protected readonly encounterStatuses = ENCOUNTER_STATUS;
  protected readonly encounterTones = encounterTone;
  protected readonly allergyTypes = ALLERGY_TYPE;
  protected readonly allergySeverities = ALLERGY_SEVERITY;
  protected readonly allergyStatuses = ALLERGY_STATUS;
  protected readonly backgroundTypes = BACKGROUND_TYPE;
  protected readonly allergyTypeOptions = options(ALLERGY_TYPE);
  protected readonly severityOptions = options(ALLERGY_SEVERITY);
  protected readonly backgroundTypeOptions = options(BACKGROUND_TYPE);

  private readonly id = computed<string | null>(() => this.recordId());
  protected readonly record = this.records.recordResource(this.id);

  private readonly patientId = computed(() => this.record.value()?.patientId ?? null);
  protected readonly patient = this.patients.patientResource(this.patientId);

  private readonly noStatus = signal<string | null>(null);
  private readonly encounterPage = signal(0);
  protected readonly encounters = this.records.encountersResource(
    this.noStatus,
    this.encounterPage,
    this.id,
    50,
  );
  protected readonly allergies = this.records.allergiesResource(this.id);
  protected readonly backgrounds = this.records.backgroundsResource(this.id);

  protected readonly tab = signal<Tab>('encuentros');
  protected readonly openingEncounter = signal(false);

  protected readonly canOpenEncounter = computed(() =>
    can.openEncounter(this.session.permissions()),
  );
  protected readonly canWriteBackgrounds = computed(() =>
    can.writeBackgrounds(this.session.permissions()),
  );
  protected readonly canWrite = computed(() => can.writeAllergies(this.session.permissions()));

  protected readonly isActive = computed(() => this.record.value()?.status === 'ACTIVE');
  protected readonly statusLabel = computed(() =>
    label(RECORD_STATUS, this.record.value()?.status).toLowerCase(),
  );

  protected readonly activeBackgrounds = computed(() =>
    (this.backgrounds.value() ?? []).filter((background) => background.active),
  );

  protected readonly crumbs = computed(() => [
    { label: 'Expedientes', link: '/expedientes' },
    { label: this.patient.value()?.fullName ?? this.record.value()?.recordNumber ?? 'Expediente' },
  ]);

  protected readonly heading = computed(() => this.patient.value()?.fullName ?? 'Expediente');

  protected readonly description = computed(() => {
    const record = this.record.value();
    const person = this.patient.value();
    if (record === undefined) {
      return null;
    }
    if (person === undefined) {
      return `Expediente ${record.recordNumber}`;
    }
    const document = formatDocument(person.documentNumber, person.documentComplement);
    return `${label(DOCUMENT_TYPE_SHORT, person.documentType)} ${document} · ${formatAge(person.birthDate)} · Expediente ${record.recordNumber} abierto el ${formatDate(record.openedOn)}`;
  });

  /* ------------------------------------------------------------- alergias -- */

  protected readonly addingAllergy = signal(false);
  protected readonly allergyPending = signal(false);
  protected readonly allergyFailure = signal<unknown>(null);
  protected readonly substance = signal('');
  protected readonly allergyType = signal('MEDICATION');
  protected readonly severity = signal('MODERATE');
  protected readonly reaction = signal('');
  protected readonly resolving = signal<{ id: number; substance: string } | null>(null);

  protected readonly allergyError = computed(() => {
    const failure = this.allergyFailure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected openAllergyForm(): void {
    this.substance.set('');
    this.reaction.set('');
    this.allergyFailure.set(null);
    this.addingAllergy.set(true);
  }

  protected async saveAllergy(): Promise<void> {
    this.allergyPending.set(true);
    this.allergyFailure.set(null);
    try {
      await this.records.createAllergy(this.recordId(), {
        type: this.allergyType(),
        substance: this.substance().trim(),
        severity: this.severity(),
        reaction: this.reaction().trim() || null,
      });
      this.allergies.reload();
      this.toasts.notify('Alergia registrada. Se mostrará como advertencia en los encuentros.');
      this.addingAllergy.set(false);
    } catch (failure) {
      this.allergyFailure.set(failure);
    } finally {
      this.allergyPending.set(false);
    }
  }

  protected async resolveAllergy(): Promise<void> {
    const target = this.resolving();
    if (target === null) {
      return;
    }
    this.allergyPending.set(true);
    try {
      await this.records.updateAllergy(target.id, { status: 'RESOLVED' });
      this.allergies.reload();
      this.toasts.notify(`La alergia a ${target.substance} quedó marcada como resuelta.`);
      this.resolving.set(null);
    } catch (failure) {
      this.toasts.notify(describeFailure(failure).message, 'err');
    } finally {
      this.allergyPending.set(false);
    }
  }

  /* --------------------------------------------------------- antecedentes -- */

  protected readonly addingBackground = signal(false);
  protected readonly backgroundPending = signal(false);
  protected readonly backgroundFailure = signal<unknown>(null);
  protected readonly backgroundType = signal('PATHOLOGICAL');
  protected readonly title = signal('');
  protected readonly detail = signal('');
  protected readonly backgroundIcd10 = signal('');
  protected readonly eventDate = signal('');
  protected readonly removing = signal<Background | null>(null);

  protected readonly backgroundError = computed(() => {
    const failure = this.backgroundFailure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected openBackgroundForm(): void {
    this.title.set('');
    this.detail.set('');
    this.backgroundIcd10.set('');
    this.eventDate.set('');
    this.backgroundFailure.set(null);
    this.addingBackground.set(true);
  }

  protected async saveBackground(): Promise<void> {
    this.backgroundPending.set(true);
    this.backgroundFailure.set(null);
    try {
      await this.records.createBackground(this.recordId(), {
        type: this.backgroundType(),
        title: this.title().trim(),
        detail: this.detail().trim() || null,
        icd10Code: this.backgroundIcd10().trim().toUpperCase() || null,
        eventDate: this.eventDate() || null,
      });
      this.backgrounds.reload();
      this.toasts.notify('Antecedente registrado en el expediente.');
      this.addingBackground.set(false);
    } catch (failure) {
      this.backgroundFailure.set(failure);
    } finally {
      this.backgroundPending.set(false);
    }
  }

  protected async removeBackground(): Promise<void> {
    const target = this.removing();
    if (target === null) {
      return;
    }
    this.backgroundPending.set(true);
    try {
      await this.records.deactivateBackground(target.id);
      this.backgrounds.reload();
      this.toasts.notify('El antecedente dejó de estar activo.');
      this.removing.set(null);
    } catch (failure) {
      this.toasts.notify(describeFailure(failure).message, 'err');
    } finally {
      this.backgroundPending.set(false);
    }
  }

  protected encounterTypeLabel(type: string): string {
    return label(ENCOUNTER_TYPE, type);
  }

  protected openEncounterView(encounterId: string): void {
    void this.router.navigate(['/encuentros', encounterId]);
  }

  protected onRowKey(event: KeyboardEvent, encounterId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openEncounterView(encounterId);
    }
  }
}
