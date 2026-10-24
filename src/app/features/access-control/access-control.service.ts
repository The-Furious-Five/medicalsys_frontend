import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-url';
import { EMPTY_PAGE, Page } from '../../core/http/api-error';
import { dataResource } from '../../core/http/data-resource';
import {
  AccountStatus,
  AssignRoleInput,
  CatalogPermission,
  CreateAccountInput,
  CreateRoleInput,
  CreatedAccount,
  IdentityAccount,
  Role,
  RoleIncompatibility,
  TemporaryPassword,
  UpdateAccountInput,
  UpdateRoleInput,
} from './access-control.models';

/**
 * ms-identidad · roles, catálogo de permisos y asignación de roles a cuentas.
 *
 * Toda regla de gobierno —nadie edita un rol que tiene, nadie otorga lo que no
 * tiene, la delegación, los pares incompatibles— la decide el servicio
 * (`RoleGovernance`). Las pantallas la anticipan para no ofrecer lo imposible,
 * pero si algo se escapa, el mensaje del servicio es el que se muestra.
 */
@Injectable({ providedIn: 'root' })
export class AccessControlService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/identity`;

  /** Todos los roles, también los inactivos, con sus permisos y su delegación. */
  rolesResource() {
    return dataResource(
      httpResource<readonly Role[]>(() => `${this.baseUrl}/roles`, { defaultValue: [] }),
    );
  }

  roleResource(code: Signal<string | null>) {
    return dataResource(
      httpResource<Role>(() => {
        const value = code();
        return value ? `${this.baseUrl}/roles/${encodeURIComponent(value)}` : undefined;
      }),
    );
  }

  /** El catálogo completo, ordenado por código. */
  permissionsResource() {
    return dataResource(
      httpResource<readonly CatalogPermission[]>(() => `${this.baseUrl}/permissions`, {
        defaultValue: [],
      }),
    );
  }

  incompatibilitiesResource() {
    return dataResource(
      httpResource<readonly RoleIncompatibility[]>(() => `${this.baseUrl}/role-incompatibilities`, {
        defaultValue: [],
      }),
    );
  }

  /** El servicio limita la búsqueda a la organización de quien consulta. */
  accountsResource(query: Signal<string>, status: Signal<string | null>, page: Signal<number>) {
    return dataResource(
      httpResource<Page<IdentityAccount>>(
        () => {
          const text = query().trim();
          const state = status();
          return {
            url: `${this.baseUrl}/users`,
            params: {
              page: page(),
              size: 20,
              ...(text ? { query: text } : {}),
              ...(state ? { status: state } : {}),
            },
          };
        },
        { defaultValue: EMPTY_PAGE },
      ),
    );
  }

  createRole(body: CreateRoleInput): Promise<Role> {
    return firstValueFrom(this.http.post<Role>(`${this.baseUrl}/roles`, body));
  }

  updateRole(code: string, body: UpdateRoleInput): Promise<Role> {
    return firstValueFrom(this.http.patch<Role>(this.rolePath(code), body));
  }

  /** Desactiva el rol; el servicio no lo borra, para conservar las asignaciones. */
  deactivateRole(code: string): Promise<Role> {
    return firstValueFrom(this.http.delete<Role>(this.rolePath(code)));
  }

  /** Reemplaza el conjunto completo de permisos del rol. */
  replacePermissions(code: string, permissions: readonly string[]): Promise<Role> {
    return firstValueFrom(
      this.http.put<Role>(`${this.rolePath(code)}/permissions`, { permissions }),
    );
  }

  replaceAssignableRoles(code: string, roles: readonly string[]): Promise<Role> {
    return firstValueFrom(
      this.http.put<Role>(`${this.rolePath(code)}/assignable-roles`, { roles }),
    );
  }

  declareIncompatible(roleA: string, roleB: string, reason: string): Promise<RoleIncompatibility> {
    return firstValueFrom(
      this.http.post<RoleIncompatibility>(`${this.baseUrl}/role-incompatibilities`, {
        roleA,
        roleB,
        reason,
      }),
    );
  }

  removeIncompatibility(roleA: string, roleB: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${this.baseUrl}/role-incompatibilities/${encodeURIComponent(roleA)}/${encodeURIComponent(roleB)}`,
      ),
    );
  }

  /* ---- Gestión de usuarios (IAM-04/IAM-05). Keycloak guarda la credencial; ms-identidad la
     sincroniza en cada operación, así que la pantalla nunca toca Keycloak directamente. ---- */

  createAccount(body: CreateAccountInput): Promise<CreatedAccount> {
    return firstValueFrom(this.http.post<CreatedAccount>(`${this.baseUrl}/users`, body));
  }

  updateAccount(accountId: string, body: UpdateAccountInput): Promise<IdentityAccount> {
    return firstValueFrom(this.http.patch<IdentityAccount>(this.accountPath(accountId), body));
  }

  /** Baja (INACTIVE) o reactivación (ACTIVE). La baja deshabilita, nunca borra. */
  changeStatus(accountId: string, status: AccountStatus, reason: string): Promise<IdentityAccount> {
    return firstValueFrom(
      this.http.patch<IdentityAccount>(`${this.accountPath(accountId)}/status`, { status, reason }),
    );
  }

  unlock(accountId: string): Promise<IdentityAccount> {
    return firstValueFrom(
      this.http.post<IdentityAccount>(`${this.accountPath(accountId)}/unlock`, {}),
    );
  }

  resetPassword(accountId: string): Promise<TemporaryPassword> {
    return firstValueFrom(
      this.http.post<TemporaryPassword>(`${this.accountPath(accountId)}/reset-password`, {}),
    );
  }

  assignRole(accountId: string, body: AssignRoleInput): Promise<IdentityAccount> {
    return firstValueFrom(
      this.http.post<IdentityAccount>(`${this.accountPath(accountId)}/roles`, body),
    );
  }

  /** Quita todas las asignaciones de ese rol a la cuenta y cierra sus sesiones. */
  revokeRole(accountId: string, role: string): Promise<IdentityAccount> {
    return firstValueFrom(
      this.http.delete<IdentityAccount>(
        `${this.accountPath(accountId)}/roles/${encodeURIComponent(role)}`,
      ),
    );
  }

  private rolePath(code: string): string {
    return `${this.baseUrl}/roles/${encodeURIComponent(code)}`;
  }

  private accountPath(accountId: string): string {
    return `${this.baseUrl}/users/${encodeURIComponent(accountId)}`;
  }
}
