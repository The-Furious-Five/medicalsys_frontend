import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  CreateCreditDebitNoteInput,
  CreateInvoiceInput,
  CreditDebitNote,
  Invoice,
  InvoiceSummary,
} from './billing.models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  invoicesResource(
    patientId: Signal<string | null>,
    page: Signal<number>,
    size = 20,
    enabled?: Signal<boolean>,
  ) {
    return dataResource(
      httpResource<Page<InvoiceSummary>>(() =>
        enabled && !enabled()
          ? undefined
          : {
              url: `${this.baseUrl}/facturas`,
              params: { size, page: page(), ...(patientId() ? { patientId: patientId()! } : {}) },
            },
      ),
    );
  }

  invoiceResource(invoiceId: Signal<string | null>) {
    return dataResource(
      httpResource<Invoice>(() => {
        const id = invoiceId();
        return id ? `${this.baseUrl}/facturas/${id}` : undefined;
      }),
    );
  }

  creditDebitNotesResource(invoiceId: Signal<string | null>) {
    return dataResource(
      httpResource<readonly CreditDebitNote[]>(() => {
        const id = invoiceId();
        return id ? `${this.baseUrl}/facturas/${id}/notas` : undefined;
      }),
    );
  }

  issue(body: CreateInvoiceInput): Promise<Invoice> {
    return firstValueFrom(this.http.post<Invoice>(`${this.baseUrl}/facturas`, body));
  }

  voidInvoice(invoiceId: string, reasonCode: number): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<Invoice>(`${this.baseUrl}/facturas/${invoiceId}/anulacion`, { reasonCode }),
    );
  }

  issueCreditDebitNote(
    invoiceId: string,
    body: CreateCreditDebitNoteInput,
  ): Promise<CreditDebitNote> {
    return firstValueFrom(
      this.http.post<CreditDebitNote>(`${this.baseUrl}/facturas/${invoiceId}/notas`, body),
    );
  }
}
