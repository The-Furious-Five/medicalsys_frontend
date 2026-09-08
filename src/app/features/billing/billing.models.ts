/**
 * ms-facturacion · `/api/v1/facturas`.
 *
 * `demo` y `caption` siguen en el contrato porque el servicio los envía, pero la
 * interfaz ya no los pinta: en este entorno todas las facturas son de
 * demostración y repetirlo en cada pantalla solo estorbaba a quien ya lo sabe.
 */

export interface InvoiceCustomer {
  readonly patientId: string;
  readonly identityDocumentTypeCode: number | null;
  readonly documentNumber: string | null;
  readonly documentComplement: string | null;
  readonly legalName: string | null;
  readonly email: string | null;
}

export interface InvoiceItem {
  readonly itemNumber: number;
  readonly serviceOfferingId: string;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discountAmount: string;
  readonly subtotal: string;
  readonly taxProductCode: string | null;
  readonly unitOfMeasure: number | null;
  readonly appointmentId: string | null;
  readonly clinicalEncounterId: string | null;
}

export interface Invoice {
  readonly id: string;
  readonly invoiceNumber: number;
  readonly taxDocumentType: string;
  readonly emissionType: string;
  readonly status: string;
  readonly demo: boolean;
  readonly caption: string | null;
  readonly cuf: string | null;
  readonly taxReceiptCode: string | null;
  readonly qrUrl: string | null;
  readonly branchId: string | null;
  readonly pointOfSale: { readonly taxBranchCode: number; readonly pointOfSaleCode: number } | null;
  readonly customer: InvoiceCustomer | null;
  readonly totalAmount: string;
  readonly vatTaxableAmount: string;
  readonly totalDiscountAmount: string;
  readonly giftCardAmount: string | null;
  readonly currencyTotalAmount: string | null;
  readonly exchangeRate: string | null;
  readonly paymentMethodCode: number | null;
  readonly issuedAt: string;
  readonly validatedAt: string | null;
  readonly items: readonly InvoiceItem[];
}

export interface InvoiceSummary {
  readonly id: string;
  readonly invoiceNumber: number;
  readonly patientId: string;
  readonly status: string;
  readonly demo: boolean;
  readonly totalAmount: string;
  readonly issuedAt: string;
}

export interface InvoiceLineInput {
  readonly serviceOfferingId: string;
  readonly quantity: string;
  readonly discountAmount: string;
  readonly clinicalEncounterId?: string | null;
}

export interface CreateInvoiceInput {
  readonly patientId: string;
  readonly branchId: string | null;
  readonly paymentMethodCode: number;
  readonly items: readonly InvoiceLineInput[];
}
