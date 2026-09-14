import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogsPage } from './catalogs-page';

describe('CatalogsPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('renders specialties returned by the gateway', async () => {
    const { fixture, http } = setup();

    http
      .expectOne('/api/v1/catalogs/specialties')
      .flush([{ id: 1, code: 'MEDICINA_GENERAL', name: 'Medicina General', active: true }]);
    http.expectOne('/api/v1/catalogs/medications').flush([]);
    http.expectOne('/api/v1/catalogs/study-types').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Medicina General');
    expect(fixture.nativeElement.textContent).toContain('1 de 1');
  });

  it('shows a recoverable error when the gateway is unreachable', async () => {
    const { fixture, http } = setup();

    http
      .expectOne('/api/v1/catalogs/specialties')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    http.expectOne('/api/v1/catalogs/medications').flush([]);
    http.expectOne('/api/v1/catalogs/study-types').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('El servicio no responde');
    expect(fixture.nativeElement.textContent).toContain('API Gateway');
  });
});

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CatalogsPage],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });

  const fixture = TestBed.createComponent(CatalogsPage);
  fixture.detectChanges();

  return {
    fixture,
    http: TestBed.inject(HttpTestingController),
  };
}