/** Identidad devuelta por ms-identidad en el login y en /auth/me. */
export interface AuthenticatedUser {
  readonly publicId: string;
  /** Usuario estándar con el que se inicia sesión (IAM-07): nombre.apellido.inicial, inmutable. */
  readonly username: string;
  readonly email: string;
  readonly fullName: string;
  readonly organizationPublicId: string;
  readonly status: string;
  /** Nivel MAC (ISO-01). Los permisos del token ya vienen filtrados por él. */
  readonly clearance: string;
  readonly language: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface LoginResponse {
  readonly tokenType: string;
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly user: AuthenticatedUser;
}

/**
 * Contraseña aceptada (202): falta el segundo factor (IAM-07). Con MFA_ENROLLMENT_REQUIRED la cuenta
 * todavía no registró su aplicación autenticadora; con MFA_REQUIRED, ya la tiene.
 */
export interface MfaChallenge {
  readonly status: 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED';
  readonly mfaToken: string;
  readonly expiresInSeconds: number;
  readonly username: string;
}

/** QR y secreto para registrar la cuenta en Google Authenticator; se muestran una sola vez. */
export interface MfaEnrollment {
  readonly issuer: string;
  readonly accountName: string;
  readonly secret: string;
  readonly otpauthUri: string;
  /** SVG del QR como data URI, generado por ms-identidad. */
  readonly qrImage: string;
}
