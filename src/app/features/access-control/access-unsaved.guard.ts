import { CanDeactivateFn } from '@angular/router';

export const accessUnsavedGuard: CanDeactivateFn<{ requestLeave(): boolean | Promise<boolean> }> = (
  component,
) => component.requestLeave();
