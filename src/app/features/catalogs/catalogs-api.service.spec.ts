import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogsApiService } from './catalogs-api.service';

describe('CatalogsApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('lists specialties from the gateway', () => {
    const { api, http } = setup();
    let received: unknown;

    api.listSpecialties().subscribe((items) => {
      received = items;
    });

    http
      .expectOne('/api/v1/catalogs/specialties')
      .flush([{ id: 1, code: 'MEDICINA_GENERAL', name: 'Medicina General', active: true }]);

    expect(received).toEqual([
      { id: 1, code: 'MEDICINA_GENERAL', name: 'Medicina General', active: true },
    ]);
  });

  it('searches CIE-10 with the q query param', () => {
    const { api, http } = setup();

    api.searchIcd10('  lumbago  ').subscribe();

    const request = http.expectOne('/api/v1/catalogs/cie10?q=lumbago');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('lists medications and study types from public catalog routes', () => {
    const { api, http } = setup();

    api.listMedications().subscribe();
    api.listStudyTypes().subscribe();

    http.expectOne('/api/v1/catalogs/medications').flush([]);
    http.expectOne('/api/v1/catalogs/study-types').flush([]);
  });
});

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), CatalogsApiService],
  });

  return {
    api: TestBed.inject(CatalogsApiService),
    http: TestBed.inject(HttpTestingController),
  };
}
