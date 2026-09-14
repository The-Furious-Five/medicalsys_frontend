import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CatalogsConnection {
  readonly offline = signal(false);

  markOnline(): void {
    this.offline.set(false);
  }

  markOffline(): void {
    this.offline.set(true);
  }
}
