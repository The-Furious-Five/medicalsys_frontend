import { Injectable, signal } from '@angular/core';

export type ToastTone = 'ok' | 'info' | 'warn' | 'err';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly message: string;
  /** Deshacer por encima de confirmar: ocho segundos en lo reversible. */
  readonly undo?: { readonly label: string; readonly run: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, number>();

  readonly toasts = signal<readonly Toast[]>([]);

  notify(message: string, tone: ToastTone = 'ok', durationMs = 4000): void {
    this.push({ id: this.nextId++, tone, message }, durationMs);
  }

  notifyUndo(message: string, undo: { label: string; run: () => void }): void {
    this.push({ id: this.nextId++, tone: 'info', message, undo }, 8000);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  private push(toast: Toast, durationMs: number): void {
    // Como mucho tres avisos a la vez: una pila más alta tapa la pantalla en
    // vez de informar.
    this.toasts.update((current) => [...current.slice(-2), toast]);
    this.timers.set(
      toast.id,
      window.setTimeout(() => this.dismiss(toast.id), durationMs),
    );
  }
}
