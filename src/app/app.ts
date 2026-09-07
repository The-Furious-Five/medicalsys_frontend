import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'medsys-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly currentYear = new Date().getFullYear();
}
