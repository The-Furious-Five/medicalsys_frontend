import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import { CreateInvoiceInput, Invoice, InvoiceSummary } from './billing.models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  invoicesResource(patientId: Signal<string | null>, page: Signal<number>, size = 20) {
    return dataResource(
      httpResource<Page<InvoiceSummary>>(() => ({
        url: `${this.baseUrl}/facturas`,
        params: { size, page: page(), ...(patientId() ? { patientId: patientId()! } : {}) },
      })),
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

  issue(body: CreateInvoiceInput): Promise<Invoice> {
    return firstValueFrom(this.http.post<Invoice>(`${this.baseUrl}/facturas`, body));
  }
}
