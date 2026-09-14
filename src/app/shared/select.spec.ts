import { ApplicationRef, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Select, SelectOption } from './select';

/**
 * El desplegable propio sustituye a `<select>`, así que tiene que conservar lo
 * que el nativo daba gratis. Si algo de esto se rompe, el control deja de ser
 * usable con teclado y no hay forma de notarlo mirando la pantalla.
 */
@Component({
  imports: [Select],
  template: `
    <medsys-select
      [options]="options"
      [value]="value()"
      (valueChange)="value.set($event)"
      ariaLabel="Estado"
      [allowEmpty]="false"
    />
  `,
})
class Host {
  readonly options: readonly SelectOption[] = [
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'SIGNED', label: 'Firmado' },
    { value: 'VOIDED', label: 'Anulado' },
  ];
  readonly value = signal('DRAFT');
}

describe('Select', () => {
  let element: HTMLElement;
  let tick: () => void;

  const trigger = () => element.querySelector<HTMLButtonElement>('.ms-select-trigger')!;
  const list = () => element.querySelector<HTMLElement>('.ms-select-list');
  const options = () => [...element.querySelectorAll<HTMLElement>('.ms-select-option')];
  const key = (name: string) => {
    (list() ?? trigger()).dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    tick();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    tick = () => {
      TestBed.inject(ApplicationRef).tick();
      fixture.detectChanges();
    };
    await Promise.resolve();
  });

  it('se anuncia como combobox y dice si está abierto', () => {
    expect(trigger().getAttribute('role')).toBe('combobox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-label')).toBe('Estado');
  });

  it('muestra la etiqueta del valor, no el valor crudo', () => {
    expect(element.querySelector('.ms-select-value')?.textContent?.trim()).toBe('Borrador');
  });

  it('abre con la flecha abajo desde el control', () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    tick();
    expect(list()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('parte de la opción ya elegida, no de la primera', () => {
    trigger().click();
    tick();
    expect(options()[0].classList.contains('is-active')).toBe(true);
  });

  it('recorre con las flechas y elige con Enter', () => {
    trigger().click();
    tick();
    key('ArrowDown');
    key('Enter');
    expect(element.querySelector('.ms-select-value')?.textContent?.trim()).toBe('Firmado');
    expect(list()).toBeNull();
  });

  it('Inicio y Fin saltan a los extremos', () => {
    trigger().click();
    tick();
    key('End');
    key('Enter');
    expect(element.querySelector('.ms-select-value')?.textContent?.trim()).toBe('Anulado');
  });

  it('Esc cierra sin cambiar el valor', () => {
    trigger().click();
    tick();
    key('ArrowDown');
    key('Escape');
    expect(list()).toBeNull();
    expect(element.querySelector('.ms-select-value')?.textContent?.trim()).toBe('Borrador');
  });

  it('marca cuál es la opción seleccionada para el lector de pantalla', () => {
    trigger().click();
    tick();
    const selected = options().filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].textContent?.trim()).toContain('Borrador');
  });
});
