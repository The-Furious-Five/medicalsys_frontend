import { Component, computed } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CatalogsConnection } from './features/catalogs/catalogs-connection';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'medsys-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly gatewayOffline = computed(() => this.connection.offline());

  constructor(private readonly connection: CatalogsConnection) {}
}
