import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthSession } from '../../core/auth/auth-session';
import { HomePage } from './home-page';

/**
 * El caso que importa: cuando un servicio falla, el panel afectado debe decirlo.
 *
 * Antes no lo hacía. `Resource.value()` lanza en estado de error, y la cabecera
 * de la tarjeta lo leía para pintar un contador antes de comprobar `error()`:
 * el render se rompía a medias y la tarjeta se quedaba congelada en su esqueleto
 * para siempre, sin mensaje y sin forma de saber qué había pasado.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.inject(ApplicationRef).tick();
}

describe('HomePage', () => {
  beforeEach(() => {
    sessionStorage.setItem(
      'medicalsys.session',
      JSON.stringify({
        accessToken: 't',
        expiresAt: Date.now() + 3_600_000,
        user: {
          publicId: 'u',
          fullName: 'Admin Demo',
          email: 'a@b.c',
          organizationPublicId: 'o',
          status: 'ACTIVE',
          language: 'es',
          roles: ['ADMINISTRATOR'],
          // Los paneles salen de los permisos del token, como en ADMINISTRATOR.
          permissions: [
            'clinical.study_order.read',
            'billing.invoice.read',
            'tenancy.organization.read',
            'tenancy.usage.read',
          ],
        },
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(AuthSession);
  });

  it('explica el fallo de un servicio en vez de quedarse cargando', async () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await settle();

    const controller = TestBed.inject(HttpTestingController);
    for (const request of controller.match(() => true)) {
      const url = request.request.urlWithParams;
      if (url.includes('/ordenes-estudio')) {
        // Este es el endpoint que hoy devuelve 500 en el entorno local, con el
        // cuerpo exacto del contrato de error común de MedicalSys.
        request.flush(
          {
            timestamp: '2026-09-02T02:28:02Z',
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'Ocurrio un fallo inesperado al procesar la solicitud',
            correlationId: '2e5c4f6f-032a-42f1-b3f4-367c78053850',
            path: '/api/v1/ordenes-estudio',
          },
          { status: 500, statusText: 'Server Error' },
        );
      } else if (url.includes('/tenancy/organizacion')) {
        request.flush({ id: 'o', tradeName: 'Clinica Demo', status: 'ACTIVE' });
      } else if (url.includes('/tenancy/consumo')) {
        request.flush([
          { metric: 'BRANCHES', currentValue: 1, limit: 1, remaining: 0, exceeded: false },
        ]);
      } else {
        request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }
    }
    await settle();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    // El panel que falló lo dice, y ofrece salida: reintentar y copiar un
    // resumen para soporte. En pantalla no queda ningún dato técnico.
    expect(text).toContain('El servicio devolvió un error');
    expect(root.querySelector('button.btn-secondary')?.textContent).toContain('Reintentar');
    expect(text).toContain('Copiar detalles');
    expect(text).not.toContain('2e5c4f6f');
    // Las dos oraciones del mensaje no quedan pegadas: el backend no cierra la
    // suya con punto y la interfaz lo hace antes de concatenar.
    expect(text).toContain('al procesar la solicitud. Si vuelve a ocurrir');

    // Los que sí respondieron siguen mostrando su contenido: un servicio caído
    // degrada su propia sección, no la pantalla entera.
    expect(text).toContain('Clinica Demo');

    // Y no queda ningún esqueleto girando.
    expect(root.querySelectorAll('.skeleton').length).toBe(0);
  });
});
