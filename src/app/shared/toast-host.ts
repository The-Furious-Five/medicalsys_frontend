import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon, IconName } from '../core/ui/icon';
import { ToastService, ToastTone } from '../core/toast/toast.service';

const TONE_ICON: Record<ToastTone, IconName> = {
  ok: 'check',
  info: 'activity',
  warn: 'alert-triangle',
  err: 'alert-triangle',
};

/**
 * Zona de avisos. `aria-live="polite"` anuncia los cambios de estado sin
 * interrumpir lo que el usuario esté haciendo.
 */
@Component({
  selector: 'medsys-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toast-region" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.tone">
          <span class="toast-icon"><medsys-icon [name]="iconFor(toast.tone)" [size]="15" /></span>
          <span class="grow">{{ toast.message }}</span>
          @if (toast.undo; as undo) {
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="runUndo(toast.id, undo.run)"
            >
              {{ undo.label }}
            </button>
          }
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-icon"
            aria-label="Descartar aviso"
            (click)="toasts.dismiss(toast.id)"
          >
            <medsys-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);

  protected iconFor(tone: ToastTone): IconName {
    return TONE_ICON[tone];
  }

  protected runUndo(id: number, run: () => void): void {
    run();
    this.toasts.dismiss(id);
  }
}
