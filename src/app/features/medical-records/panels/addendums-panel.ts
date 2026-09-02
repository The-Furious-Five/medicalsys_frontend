import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { describeFailure } from '../../../core/http/api-error';
import { FORMAT_PIPES } from '../../../core/format/format.pipe';
import { ADDENDUM_REASON, label, options } from '../../../core/labels/labels';
import { ToastService } from '../../../core/toast/toast.service';
import { Icon } from '../../../core/ui/icon';
import { Dialog } from '../../../shared/dialog';
import { Notice } from '../../../shared/notice';
import { Skeleton } from '../../../shared/skeleton';
import { RecordsService } from '../records.service';

/**
 * Addendums de un encuentro firmado.
 *
 * Un addendum no edita: añade. Se presenta en orden cronológico y con el motivo
 * visible, para que quien lea la historia entienda por qué se amplió y cuándo.
 */
@Component({
  selector: 'medsys-addendums-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Dialog, Notice, Skeleton, ...FORMAT_PIPES],
  templateUrl: './addendums-panel.html',
})
export class AddendumsPanel {
  readonly encounterId = input.required<string>();
  readonly canAdd = input(false);
  readonly professionalId = input.required<string>();

  private readonly records = inject(RecordsService);
  private readonly toasts = inject(ToastService);

  protected readonly reasonOptions = options(ADDENDUM_REASON);

  private readonly id = computed<string | null>(() => this.encounterId());
  protected readonly addendums = this.records.addendumsResource(this.id);

  protected readonly adding = signal(false);
  protected readonly pending = signal(false);
  protected readonly failure = signal<unknown>(null);
  protected readonly reason = signal('CORRECTION');
  protected readonly text = signal('');

  protected readonly errorMessage = computed(() => {
    const failure = this.failure();
    return failure === null ? null : describeFailure(failure).message;
  });

  protected reasonLabel(value: string): string {
    return label(ADDENDUM_REASON, value);
  }

  protected openForm(): void {
    this.text.set('');
    this.failure.set(null);
    this.adding.set(true);
  }

  protected async save(): Promise<void> {
    this.pending.set(true);
    this.failure.set(null);
    try {
      await this.records.createAddendum(this.encounterId(), {
        professionalId: this.professionalId(),
        reason: this.reason(),
        text: this.text().trim(),
      });
      this.addendums.reload();
      this.toasts.notify('Addendum agregado al encuentro.');
      this.adding.set(false);
    } catch (failure) {
      this.failure.set(failure);
    } finally {
      this.pending.set(false);
    }
  }
}
