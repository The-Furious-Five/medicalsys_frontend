import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { formatAge, formatDocument } from '../../core/format/format';
import { DOCUMENT_TYPE_SHORT, label } from '../../core/labels/labels';
import { Icon } from '../../core/ui/icon';
import { Skeleton } from '../../shared/skeleton';
import { PatientsService } from './patients.service';
import { Patient } from './patients.models';

/**
 * Selector de paciente por nombre o documento.
 *
 * Es el punto de entrada de casi todo el trabajo clínico y de facturación, así
 * que resuelve en un solo control: escribir, ver, elegir. Sin diálogo previo ni
 * dos pasos, y con lo elegido siempre visible.
 */
@Component({
  selector: 'medsys-patient-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Skeleton],
  templateUrl: './patient-picker.html',
})
export class PatientPicker {
  readonly patientId = model<string | null>(null);
  readonly placeholder = input('Buscar paciente');
  readonly autoFocus = input(false);

  private readonly patients = inject(PatientsService);

  protected readonly term = signal('');
  protected readonly open = signal(false);
  protected readonly highlighted = signal(0);
  protected readonly results = signal<readonly Patient[]>([]);
  protected readonly searching = signal(false);
  protected readonly failed = signal(false);
  protected readonly selected = signal<Patient | null>(null);
  protected readonly loadingSelected = signal(false);

  constructor() {
    effect(() => {
      const id = this.patientId();
      if (id === null) {
        this.selected.set(null);
        return;
      }
      this.loadingSelected.set(true);
      this.patients.get(id).then(
        (person) => {
          this.selected.set(person);
          this.loadingSelected.set(false);
        },
        () => {
          this.selected.set(null);
          this.loadingSelected.set(false);
        },
      );
    });

    // Un clic fuera cierra la lista sin perder lo ya seleccionado.
    document.addEventListener('pointerdown', (event) => {
      if (this.open() && !(event.target as Element)?.closest('medsys-patient-picker')) {
        this.open.set(false);
      }
    });
  }

  protected async onInput(value: string): Promise<void> {
    this.term.set(value);
    this.open.set(true);
    this.highlighted.set(0);

    const query = value.trim();
    if (query.length < 2) {
      this.results.set([]);
      return;
    }

    this.searching.set(true);
    this.failed.set(false);
    try {
      const page = await this.patients.search(query, 6);
      if (this.term().trim() !== query) {
        return;
      }
      this.results.set(page.content);
    } catch {
      this.results.set([]);
      this.failed.set(true);
    } finally {
      if (this.term().trim() === query) {
        this.searching.set(false);
      }
    }
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const total = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlighted.update((current) => Math.min(current + 1, total - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlighted.update((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.pick(this.results()[this.highlighted()]);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected pick(patient: Patient | undefined): void {
    if (patient === undefined) {
      return;
    }
    this.patientId.set(patient.patientId);
    this.open.set(false);
  }

  protected clear(): void {
    this.patientId.set(null);
    this.term.set('');
    this.results.set([]);
    this.open.set(true);
  }

  protected documentLine(person: Patient): string {
    const document = formatDocument(person.documentNumber, person.documentComplement);
    return `${label(DOCUMENT_TYPE_SHORT, person.documentType)} ${document} · ${formatAge(person.birthDate)}`;
  }
}
