import { Component } from '@angular/core';

interface MvpStep {
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'Base disponible' | 'Por implementar';
}

@Component({
  selector: 'medsys-home-page',
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly mvpSteps: readonly MvpStep[] = [
    {
      number: '01',
      title: 'Acceso',
      description: 'Autenticación, sesión, roles y organización.',
      status: 'Base disponible',
    },
    {
      number: '02',
      title: 'Paciente',
      description: 'Registro, búsqueda y ficha resumida.',
      status: 'Por implementar',
    },
    {
      number: '03',
      title: 'Agenda',
      description: 'Profesional, disponibilidad y confirmación de cita.',
      status: 'Por implementar',
    },
    {
      number: '04',
      title: 'Atención',
      description: 'Encuentro, diagnóstico, firma y orden de estudio.',
      status: 'Por implementar',
    },
    {
      number: '05',
      title: 'Documento',
      description: 'Carga del resultado y entrega manual al paciente.',
      status: 'Por implementar',
    },
    {
      number: '06',
      title: 'Factura demo',
      description: 'Emisión simulada y consulta del comprobante.',
      status: 'Por implementar',
    },
  ];
}
