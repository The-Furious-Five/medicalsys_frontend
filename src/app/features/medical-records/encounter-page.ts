import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { describeFailure } from '../../core/http/api-error';
import { FORMAT_PIPES } from '../../core/format/format.pipe';
import { formatAge, formatDocument, formatTime } from '../../core/format/format';
import {
  DOCUMENT_TYPE_SHORT,
  ENCOUNTER_STATUS,
  ENCOUNTER_TYPE,
  label,
} from '../../core/labels/labels';
import { encounterTone, isEncounterEditable } from '../../core/state/state-machines';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { Dialog } from '../../shared/dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Skeleton } from '../../shared/skeleton';
import { StatusChip } from '../../shared/status-chip';
import { PatientsService } from '../patients/patients.service';
import { AddendumsPanel } from './panels/addendums-panel';
import { DiagnosesPanel } from './panels/diagnoses-panel';
import { PatientContext } from './panels/patient-context';
import { PrescriptionsPanel } from './panels/prescriptions-panel';
import { StudyOrdersPanel } from './panels/study-orders-panel';
import { VitalsPanel } from './panels/vitals-panel';
import { RecordsService } from './records.service';

type NarrativeKey = 'chiefComplaint' | 'subjective' | 'objective' | 'assessment' | 'plan';

interface Section {
  readonly key: NarrativeKey;
  readonly label: string;
  readonly hint: string;
  readonly rows: number;
}

const SECTIONS: readonly Section[] = [
  {
    key: 'chiefComplaint',
    label: 'Motivo de consulta',
    rows: 2,
    hint: 'Lo que la persona viene a resolver, en sus palabras.',
  },
  {
    key: 'subjective',
    label: 'Subjetivo',
    rows: 4,
    hint: 'Lo que refiere el paciente: síntomas, evolución, antecedentes del episodio.',
  },
  {
    key: 'objective',
    label: 'Objetivo',
    rows: 4,
    hint: 'Hallazgos de la exploración física y de los estudios disponibles.',
  },
  {
    key: 'assessment',
    label: 'Evaluación',
    rows: 4,
    hint: 'Interpretación clínica y razonamiento diagnóstico.',
  },
  {
    key: 'plan',
    label: 'Plan',
    rows: 4,
    hint: 'Conducta, tratamiento, indicaciones y seguimiento.',
  },
];

const EMPTY_NARRATIVE: Record<NarrativeKey, string> = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

/**
 * Jerarquía: a la izquierda el contexto persistente del paciente — quién es, a
 * qué es alérgico, qué antecedentes tiene — porque se consulta constantemente y
 * nunca debe obligar a cambiar de pantalla. A la derecha el encuentro en sí,
 * que es donde se escribe.
 *
 * La firma cambia el modo de la pantalla entera: de escritura a lectura. Es la
 * transición más importante de la aplicación, y por eso es explícita.
 */
@Component({
  selector: 'medsys-encounter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    StatusChip,
    ErrorState,
    Notice,
    Skeleton,
    Icon,
    ConfirmDialog,
    Dialog,
    PatientContext,
    VitalsPanel,
    DiagnosesPanel,
    PrescriptionsPanel,
    StudyOrdersPanel,
    AddendumsPanel,
    ...FORMAT_PIPES,
  ],
  templateUrl: './encounter-page.html',
})
export class EncounterPage {
  readonly encounterId = input.required<string>();

  private readonly records = inject(RecordsService);
  private readonly patients = inject(PatientsService);
  private readonly session = inject(AuthSession);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sections = SECTIONS;
  protected readonly encounterStatuses = ENCOUNTER_STATUS;
  protected readonly encounterTones = encounterTone;

  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly encounter = this.records.encounterResource(this.id);

  private readonly patientId = computed(() => this.encounter.value()?.patientId ?? null);
  protected readonly patient = this.patients.patientResource(this.patientId);

  protected readonly userId = computed(() => this.session.user()?.publicId ?? '');
  protected readonly userName = computed(() => this.session.user()?.fullName ?? 'tu cuenta');

  protected readonly status = computed(() => this.encounter.value()?.status ?? 'DRAFT');
  protected readonly isDraft = computed(() => isEncounterEditable(this.status()));
  protected readonly isSigned = computed(() => this.status() === 'SIGNED');
  protected readonly isVoided = computed(() => this.status() === 'VOIDED');

  protected readonly canWrite = computed(
    () => this.isDraft() && can.writeNarrative(this.session.roles()),
  );
  protected readonly canWriteVitals = computed(
    () => this.isDraft() && can.writeVitals(this.session.roles()),
  );
  protected readonly canSign = computed(
    () => this.isDraft() && can.signEncounter(this.session.roles()),
  );
  protected readonly canVoid = computed(
    () => !this.isVoided() && can.voidEncounter(this.session.roles()),
  );
  /** Corregir un encuentro firmado exige el mismo permiso que firmarlo. */
  protected readonly canAddAddendum = computed(
    () => this.isSigned() && can.signEncounter(this.session.roles()),
  );

  /* ------------------------------------------------------------ narrativa -- */

  protected readonly narrative = signal<Record<NarrativeKey, string>>({ ...EMPTY_NARRATIVE });
  protected readonly dirty = signal(false);
  protected readonly savedAt = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveFailure = signal<unknown>(null);

  private saveTimer?: number;
  /** Copia viva de lo escrito, para poder volcarla al abandonar la pantalla. */
  private pending: { dirty: boolean; values: Record<NarrativeKey, string> } = {
    dirty: false,
    values: { ...EMPTY_NARRATIVE },
  };

  protected readonly saveStatus = computed(() => {
    if (!this.canWrite()) return null;
    if (this.saving()) return 'Guardando…';
    if (this.saveFailure() !== null) return 'No se pudo guardar';
    if (this.dirty()) return 'Cambios sin guardar';
    const at = this.savedAt();
    return at ? `Guardado ${formatTime(at)}` : 'Se guarda solo mientras escribes';
  });

  protected readonly saveErrorMessage = computed(() => {
    const failure = this.saveFailure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly visibleSections = computed(() =>
    this.canWrite()
      ? SECTIONS
      : SECTIONS.filter((section) => this.narrative()[section.key].trim().length > 0),
  );

  protected readonly hasNarrative = computed(() =>
    Object.values(this.narrative()).some((value) => value.trim().length > 0),
  );

  /* -------------------------------------------------------------- acciones - */

  protected readonly signing = signal(false);
  protected readonly voiding = signal(false);
  protected readonly voidReason = signal('');
  protected readonly actionPending = signal(false);
  protected readonly actionFailure = signal<unknown>(null);

  protected readonly actionErrorMessage = computed(() => {
    const failure = this.actionFailure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected readonly crumbs = computed(() => [
    { label: 'Encuentros', link: '/encuentros' },
    { label: this.patient.value()?.fullName ?? 'Encuentro' },
  ]);

  protected readonly typeLabel = computed(() =>
    label(ENCOUNTER_TYPE, this.encounter.value()?.type),
  );

  protected readonly patientSummary = computed(() => {
    const person = this.patient.value();
    if (person === undefined) {
      return null;
    }
    const document = formatDocument(person.documentNumber, person.documentComplement);
    return `${person.fullName} · ${label(DOCUMENT_TYPE_SHORT, person.documentType)} ${document} · ${formatAge(person.birthDate)}`;
  });

  constructor() {
    // La narrativa que llega del servidor siembra el formulario una sola vez;
    // después manda lo que el profesional está escribiendo.
    effect(() => {
      const encounter = this.encounter.value();
      if (encounter === undefined || this.pending.dirty) {
        return;
      }
      this.narrative.set({
        chiefComplaint: encounter.narrative?.chiefComplaint ?? '',
        subjective: encounter.narrative?.subjective ?? '',
        objective: encounter.narrative?.objective ?? '',
        assessment: encounter.narrative?.assessment ?? '',
        plan: encounter.narrative?.plan ?? '',
      });
    });

    // Al salir de la pantalla se vuelca lo pendiente. Cancelar el temporizador
    // sin guardar perdería texto clínico ya escrito.
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(this.saveTimer);
      if (this.pending.dirty) {
        void this.persist(this.pending.values);
      }
    });
  }

  protected setSection(key: NarrativeKey, value: string): void {
    this.narrative.update((current) => ({ ...current, [key]: value }));
    this.dirty.set(true);
    this.pending = { dirty: true, values: this.narrative() };

    // Autoguardado dos segundos después de dejar de escribir. Sin un aviso por
    // cada guardado: un indicador textual discreto basta y no interrumpe.
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.persist(this.narrative()), 2000);
  }

  private async persist(values: Record<NarrativeKey, string>): Promise<void> {
    const encounter = this.encounter.value();
    if (encounter === undefined) {
      return;
    }
    this.saving.set(true);
    this.saveFailure.set(null);
    try {
      await this.records.updateNarrative(encounter.id, {
        chiefComplaint: values.chiefComplaint || null,
        subjective: values.subjective || null,
        objective: values.objective || null,
        assessment: values.assessment || null,
        plan: values.plan || null,
        type: encounter.type,
      });
      this.savedAt.set(new Date().toISOString());
      this.dirty.set(false);
      this.pending = { dirty: false, values };
    } catch (failure) {
      this.saveFailure.set(failure);
    } finally {
      this.saving.set(false);
    }
  }

  protected async sign(): Promise<void> {
    this.actionPending.set(true);
    this.actionFailure.set(null);
    try {
      // Lo escrito y sin guardar se persiste antes de firmar: firmar un
      // encuentro sin la última frase sería peor que no firmarlo.
      if (this.pending.dirty) {
        window.clearTimeout(this.saveTimer);
        await this.persist(this.pending.values);
      }
      await this.records.signEncounter(this.encounterId());
      this.encounter.reload();
      this.signing.set(false);
      this.toasts.notify('Encuentro firmado. A partir de ahora es de solo lectura.');
    } catch (failure) {
      this.actionFailure.set(failure);
    } finally {
      this.actionPending.set(false);
    }
  }

  protected async voidEncounter(): Promise<void> {
    this.actionPending.set(true);
    this.actionFailure.set(null);
    try {
      await this.records.voidEncounter(this.encounterId(), this.voidReason().trim());
      this.encounter.reload();
      this.voiding.set(false);
      this.voidReason.set('');
      this.toasts.notify('Encuentro anulado.');
    } catch (failure) {
      this.actionFailure.set(failure);
    } finally {
      this.actionPending.set(false);
    }
  }

  protected signDescription(): string {
    return `Al firmar, el contenido de este encuentro queda inmutable: no podrás editar la narrativa, los signos vitales ni los diagnósticos. Cualquier corrección posterior deberá registrarse como un addendum, que se añade al final sin borrar lo escrito. Quedará firmado a nombre de ${this.userName()}.`;
  }
}
