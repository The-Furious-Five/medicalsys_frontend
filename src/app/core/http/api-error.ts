import { HttpErrorResponse } from '@angular/common/http';

/**
 * Contrato de error común a los servicios de MedicalSys.
 *
 * `details` llega como lista de violaciones por campo (ver `ApiError.FieldViolation`
 * en los servicios Java), no como diccionario: cada entrada nombra el campo del
 * formulario que el backend rechazó.
 */
export interface FieldViolation {
  readonly field: string;
  readonly message: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  correlationId: string;
  path: string;
  details?: readonly FieldViolation[];
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ApiError>;

  return (
    typeof candidate.timestamp === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.correlationId === 'string' &&
    typeof candidate.path === 'string'
  );
}

/**
 * ms-identidad no usa el contrato común: responde con ProblemDetail (RFC 9457),
 * y el texto que explica el rechazo está en `detail`. Sin leerlo, las reglas de
 * gobierno de roles —nadie edita un rol propio, el par incompatible, la
 * delegación— llegaban como un conflicto genérico que no dice qué corregir.
 */
interface ProblemDetail {
  readonly status: number;
  readonly detail: string;
  readonly correlationId?: string;
}

function isProblemDetail(value: unknown): value is ProblemDetail {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ProblemDetail>;
  return typeof candidate.status === 'number' && typeof candidate.detail === 'string';
}

/** Fallo ya interpretado: lo que la interfaz necesita para explicarlo. */
export interface FailureDetail {
  readonly title: string;
  readonly message: string;
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;
  readonly fieldErrors: readonly FieldViolation[];
  /** Reintentar solo tiene sentido cuando el fallo puede ser pasajero. */
  readonly retryable: boolean;
  readonly icon: string;
}

/**
 * Los servicios devuelven su mensaje sin punto final. Al encadenarlo con la
 * frase de ayuda quedaban dos oraciones pegadas —«...la solicitud Si vuelve a
 * ocurrir»—, así que la puntuación se cierra aquí antes de concatenar.
 */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

const DEFAULT_MESSAGES: Readonly<Record<number, string>> = {
  0: 'No hay comunicación con el servidor de MedicalSys. Comprueba tu conexión; si el problema continúa, avisa al responsable del sistema.',
  400: 'Los datos enviados no son válidos. Revisa el formulario.',
  401: 'La sesión terminó. Vuelve a iniciar sesión para continuar.',
  403: 'Tu rol no tiene permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe o fue dado de baja.',
  409: 'La operación entra en conflicto con el estado actual de los datos.',
  422: 'La operación no se puede completar con los datos actuales.',
};

/**
 * Traduce cualquier fallo a un mensaje humano, en español y sin culpar al
 * usuario. Distingue no tienes permiso (403), no existe (404), conflicto de
 * negocio (409/422), datos inválidos (400) y el servicio no responde (0 y 5xx).
 * Nunca expone un JSON crudo ni un rastro de pila.
 */
export function describeFailure(failure: unknown): FailureDetail {
  if (!(failure instanceof HttpErrorResponse)) {
    return {
      title: 'No se pudo mostrar esta información',
      message: 'Ocurrió un problema inesperado al preparar la vista. Vuelve a intentarlo.',
      status: -1,
      code: 'UNEXPECTED',
      correlationId: null,
      fieldErrors: [],
      retryable: true,
      icon: 'alert-triangle',
    };
  }

  const body: unknown = failure.error;
  const api = isApiError(body) ? body : null;
  const problem = api === null && isProblemDetail(body) ? body : null;
  const correlationId =
    api?.correlationId ??
    problem?.correlationId ??
    failure.headers?.get('X-Correlation-Id') ??
    null;
  const fieldErrors = api?.details ?? [];
  const message =
    api?.message ??
    problem?.detail ??
    DEFAULT_MESSAGES[failure.status] ??
    'No se pudo completar la operación.';
  const code = api?.code ?? `HTTP_${failure.status}`;

  const base = { status: failure.status, code, correlationId, fieldErrors };

  // Status 0 es red caída, gateway apagado o CORS: no llegó a haber respuesta.
  if (failure.status === 0) {
    return {
      ...base,
      title: 'El servicio no responde',
      message: DEFAULT_MESSAGES[0],
      retryable: true,
      icon: 'unplug',
    };
  }
  if (failure.status === 403) {
    return {
      ...base,
      title: 'Sin permiso para esta sección',
      message: `Tu rol no incluye este acceso. ${sentence(message)}`,
      retryable: false,
      icon: 'shield-off',
    };
  }
  if (failure.status === 404) {
    return {
      ...base,
      title: 'No se encontró el registro',
      message: `${sentence(message)} Es posible que se haya dado de baja o que el enlace ya no sea válido.`,
      retryable: false,
      icon: 'search-x',
    };
  }
  if (failure.status === 409 || failure.status === 422) {
    return {
      ...base,
      title: 'La operación entra en conflicto',
      message: sentence(message),
      retryable: false,
      icon: 'circle-slash',
    };
  }
  if (failure.status === 400) {
    return {
      ...base,
      title: 'Los datos no son válidos',
      message: sentence(message),
      retryable: false,
      icon: 'alert-triangle',
    };
  }

  return {
    ...base,
    title: 'El servicio devolvió un error',
    message: `${sentence(message)} Si vuelve a ocurrir, comparte el identificador de la operación con soporte.`,
    retryable: true,
    icon: 'alert-triangle',
  };
}

/** Página de resultados: contrato estable y común a los tres servicios. */
export interface Page<T> {
  readonly content: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export const EMPTY_PAGE: Page<never> = {
  content: [],
  page: 0,
  size: 0,
  totalElements: 0,
  totalPages: 0,
};
