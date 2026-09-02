/**
 * ms-facturacion · `/api/v1/facturas`.
 *
 * Toda factura emitida en este entorno lleva `demo: true` y una leyenda que la
 * interfaz muestra siempre, de forma visible y no descartable.
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

/**
 * Leyenda obligatoria. El backend la devuelve en `caption`, pero la interfaz no
 * depende de que llegue: una factura sin validez fiscal debe decirlo siempre,
 * incluso si el servicio omitiera el campo.
 */
export const DEMO_CAPTION = 'Documento de demostración — sin validez fiscal';
