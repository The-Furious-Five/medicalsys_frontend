/** Identidad devuelta por ms-identidad en el login y en /auth/me. */
export interface AuthenticatedUser {
  readonly publicId: string;
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
