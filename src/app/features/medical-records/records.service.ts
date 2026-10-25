import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  PrescriptionStatus,
  RecordStatus,
  StudyOrderStatus,
} from '../../core/state/state-machines';
import {
  Addendum,
  Allergy,
  Background,
  Diagnosis,
  Encounter,
  EncounterSummary,
  MedicalRecord,
  Prescription,
  StudyOrder,
  StudyResult,
  VitalSign,
} from './records.models';

@Injectable({ providedIn: 'root' })
export class RecordsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---------------------------------------------------------- expedientes -- */

  recordsResource(page: Signal<number>) {
    return dataResource(
      httpResource<Page<MedicalRecord>>(() => ({
        url: `${this.baseUrl}/expedientes`,
        params: { size: 20, page: page() },
      })),
    );
  }

  recordResource(recordId: Signal<string | null>) {
    return dataResource(
      httpResource<MedicalRecord>(() => {
        const id = recordId();
        return id ? `${this.baseUrl}/expedientes/${id}` : undefined;
      }),
    );
  }

  /** Devuelve el expediente del paciente. Un 404 aquí no es un fallo: significa
   *  que la persona todavía no tiene expediente, que es lo normal antes de la
   *  primera atención. */
  recordByPatientResource(patientId: Signal<string | null>) {
    return dataResource(
      httpResource<MedicalRecord>(() => {
        const id = patientId();
        return id ? { url: `${this.baseUrl}/expedientes`, params: { patientId: id } } : undefined;
      }),
    );
  }

  /** Idempotente: si ya existe, el backend devuelve 200 con el mismo expediente. */
  openRecord(patientId: string, branchId: string | null): Promise<MedicalRecord> {
    return firstValueFrom(
      this.http.post<MedicalRecord>(`${this.baseUrl}/expedientes`, { patientId, branchId }),
    );
  }

  changeRecordStatus(recordId: string, status: RecordStatus): Promise<MedicalRecord> {
    return firstValueFrom(
      this.http.patch<MedicalRecord>(`${this.baseUrl}/expedientes/${recordId}/estado`, { status }),
    );
  }

  allergiesResource(recordId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Allergy[]>(
        () => {
          const id = recordId();
          return id ? `${this.baseUrl}/expedientes/${id}/alergias` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createAllergy(recordId: string, body: Record<string, unknown>): Promise<Allergy> {
    return firstValueFrom(
      this.http.post<Allergy>(`${this.baseUrl}/expedientes/${recordId}/alergias`, body),
    );
  }

  updateAllergy(allergyId: number, body: Record<string, unknown>): Promise<Allergy> {
    return firstValueFrom(this.http.patch<Allergy>(`${this.baseUrl}/alergias/${allergyId}`, body));
  }

  backgroundsResource(recordId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Background[]>(
        () => {
          const id = recordId();
          return id ? `${this.baseUrl}/expedientes/${id}/antecedentes` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createBackground(recordId: string, body: Record<string, unknown>): Promise<Background> {
    return firstValueFrom(
      this.http.post<Background>(`${this.baseUrl}/expedientes/${recordId}/antecedentes`, body),
    );
  }

  deactivateBackground(backgroundId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/antecedentes/${backgroundId}`));
  }

  /* ----------------------------------------------------------- encuentros -- */

  encountersResource(
    status: Signal<string | null>,
    page: Signal<number>,
    recordId?: Signal<string | null>,
    size = 20,
    enabled?: Signal<boolean>,
  ) {
    return dataResource(
      httpResource<Page<EncounterSummary>>(() =>
        enabled && !enabled()
          ? undefined
          : {
              url: `${this.baseUrl}/encuentros`,
              params: {
                size,
                page: page(),
                ...(status() ? { status: status()! } : {}),
                ...(recordId?.() ? { recordId: recordId()! } : {}),
              },
            },
      ),
    );
  }

  encounterResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<Encounter>(() => {
        const id = encounterId();
        return id ? `${this.baseUrl}/encuentros/${id}` : undefined;
      }),
    );
  }

  openEncounter(body: {
    patientId: string;
    professionalId: string;
    branchId: string;
    type: string;
  }): Promise<Encounter> {
    return firstValueFrom(this.http.post<Encounter>(`${this.baseUrl}/encuentros`, body));
  }

  updateNarrative(encounterId: string, body: Record<string, unknown>): Promise<Encounter> {
    return firstValueFrom(
      this.http.put<Encounter>(`${this.baseUrl}/encuentros/${encounterId}/notas`, body),
    );
  }

  signEncounter(encounterId: string): Promise<Encounter> {
    return firstValueFrom(
      this.http.post<Encounter>(`${this.baseUrl}/encuentros/${encounterId}/firma`, {
        certificateId: null,
      }),
    );
  }

  voidEncounter(encounterId: string, reason: string): Promise<Encounter> {
    return firstValueFrom(
      this.http.post<Encounter>(`${this.baseUrl}/encuentros/${encounterId}/anulacion`, { reason }),
    );
  }

  addendumsResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Addendum[]>(
        () => {
          const id = encounterId();
          return id ? `${this.baseUrl}/encuentros/${id}/addendums` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createAddendum(
    encounterId: string,
    body: { professionalId: string; reason: string; text: string },
  ): Promise<Addendum> {
    return firstValueFrom(
      this.http.post<Addendum>(`${this.baseUrl}/encuentros/${encounterId}/addendums`, body),
    );
  }

  vitalsResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly VitalSign[]>(
        () => {
          const id = encounterId();
          return id ? `${this.baseUrl}/encuentros/${id}/signos-vitales` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createVital(encounterId: string, body: Record<string, unknown>): Promise<VitalSign> {
    return firstValueFrom(
      this.http.post<VitalSign>(`${this.baseUrl}/encuentros/${encounterId}/signos-vitales`, body),
    );
  }

  diagnosesResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Diagnosis[]>(
        () => {
          const id = encounterId();
          return id ? `${this.baseUrl}/encuentros/${id}/diagnosticos` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createDiagnosis(encounterId: string, body: Record<string, unknown>): Promise<Diagnosis> {
    return firstValueFrom(
      this.http.post<Diagnosis>(`${this.baseUrl}/encuentros/${encounterId}/diagnosticos`, body),
    );
  }

  /* -------------------------------------------------------------- recetas -- */

  prescriptionsResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly Prescription[]>(
        () => {
          const id = encounterId();
          return id ? `${this.baseUrl}/encuentros/${id}/recetas` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createPrescription(encounterId: string, body: Record<string, unknown>): Promise<Prescription> {
    return firstValueFrom(
      this.http.post<Prescription>(`${this.baseUrl}/encuentros/${encounterId}/recetas`, body),
    );
  }

  changePrescriptionStatus(
    prescriptionId: string,
    status: PrescriptionStatus,
  ): Promise<Prescription> {
    return firstValueFrom(
      this.http.patch<Prescription>(`${this.baseUrl}/recetas/${prescriptionId}/estado`, { status }),
    );
  }

  /* --------------------------------------------------- órdenes de estudio -- */

  studyOrdersResource(
    status: Signal<string | null>,
    page: Signal<number>,
    size = 20,
    enabled?: Signal<boolean>,
  ) {
    return dataResource(
      httpResource<Page<StudyOrder>>(() =>
        enabled && !enabled()
          ? undefined
          : {
              url: `${this.baseUrl}/ordenes-estudio`,
              params: { size, page: page(), ...(status() ? { status: status()! } : {}) },
            },
      ),
    );
  }

  studyOrderResource(orderId: Signal<string | null>) {
    return dataResource(
      httpResource<StudyOrder>(() => {
        const id = orderId();
        return id ? `${this.baseUrl}/ordenes-estudio/${id}` : undefined;
      }),
    );
  }

  studyOrdersByEncounterResource(encounterId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly StudyOrder[]>(
        () => {
          const id = encounterId();
          return id ? `${this.baseUrl}/encuentros/${id}/ordenes-estudio` : undefined;
        },
        { defaultValue: [] },
      ),
    );
  }

  createStudyOrder(encounterId: string, body: Record<string, unknown>): Promise<StudyOrder> {
    return firstValueFrom(
      this.http.post<StudyOrder>(`${this.baseUrl}/encuentros/${encounterId}/ordenes-estudio`, body),
    );
  }

  changeStudyOrderStatus(orderId: string, status: StudyOrderStatus): Promise<StudyOrder> {
    return firstValueFrom(
      this.http.patch<StudyOrder>(`${this.baseUrl}/ordenes-estudio/${orderId}/estado`, { status }),
    );
  }

  registerStudyResult(orderId: string, body: Record<string, unknown>): Promise<StudyResult> {
    return firstValueFrom(
      this.http.post<StudyResult>(`${this.baseUrl}/ordenes-estudio/${orderId}/resultados`, body),
    );
  }
}
