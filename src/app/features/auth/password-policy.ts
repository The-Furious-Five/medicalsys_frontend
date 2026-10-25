/**
 * Política de contraseñas de MedicalSys (IAM-02, decisiones del kickoff C-01).
 *
 * Quien decide es Keycloak: este archivo solo la anticipa para mostrar, mientras se escribe, qué
 * falta cumplir (principio de menos asombro: nadie debería enterarse de una regla recién al
 * enviar). El histórico de las últimas 5 y la lista de frases comunes solo los conoce Keycloak; su
 * rechazo llega del servicio con el motivo en español.
 */
export interface PolicyRule {
  readonly id: string;
  readonly label: string;
  readonly met: boolean;
}

export const POLICY_SERVER_RULES: readonly string[] = [
  'No puede ser una de tus últimas 5 contraseñas.',
  'No se aceptan frases demasiado comunes (por ejemplo, «Medicalsys2026!»).',
  'Vence a los 90 días; Keycloak te pedirá cambiarla.',
];

/** `username` es el usuario de inicio de sesión (IAM-07): la contraseña no puede contenerlo. */
export function passwordRules(password: string, username: string): readonly PolicyRule[] {
  const account = username.trim().toLowerCase();
  const length = [...password].length;
  return [
    { id: 'length', label: 'Entre 12 y 64 caracteres', met: length >= 12 && length <= 64 },
    { id: 'upper', label: 'Una letra mayúscula', met: /\p{Lu}/u.test(password) },
    { id: 'lower', label: 'Una letra minúscula', met: /\p{Ll}/u.test(password) },
    { id: 'digit', label: 'Un número', met: /\d/.test(password) },
    {
      id: 'special',
      label: 'Un carácter especial; un espacio también cuenta',
      met: /[^\p{L}\d]/u.test(password),
    },
    {
      id: 'username',
      label: 'Que no contenga tu usuario',
      met: password.length > 0 && (account === '' || !password.toLowerCase().includes(account)),
    },
  ];
}

export function meetsPolicy(password: string, username: string): boolean {
  return passwordRules(password, username).every((rule) => rule.met);
}
