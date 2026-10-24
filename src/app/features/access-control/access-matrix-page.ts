import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthSession } from '../../core/auth/auth-session';
import { can } from '../../core/auth/permissions';
import { todayIso } from '../../core/format/format';
import { describeFailure } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { ErrorState } from '../../shared/error-state';
import { Notice } from '../../shared/notice';
import { PageHeader } from '../../shared/page-header';
import { Select } from '../../shared/select';
import { TableSkeleton } from '../../shared/table-skeleton';
import { Tooltip } from '../../shared/tooltip';
import { CatalogPermission } from './access-control.models';
import { AccessControlService } from './access-control.service';
import {
  Grid,
  ModuleGroup,
  changesBetween,
  gridOf,
  groupByModule,
  matrixColumn,
  matrixTable,
  orderRoles,
  rolesTable,
  toCsv,
} from './access-matrix';
import { canGrant, roleEditLock } from './access-rules';
import { workbook } from './xlsx';

type ModuleState = 'all' | 'some' | 'none';

interface SaveFailure {
  readonly role: string;
  readonly message: string;
}

const sameMembers = (a: ReadonlySet<string> | undefined, b: ReadonlySet<string> | undefined) =>
  (a?.size ?? 0) === (b?.size ?? 0) && [...(a ?? [])].every((code) => b?.has(code));

/**
 * Matriz de roles y accesos: un rol por columna, un permiso del catálogo por
 * fila, agrupados por módulo.
 *
 * Es el registro de quién puede hacer qué. Marcar o desmarcar no cambia nada
 * hasta guardar; al guardar se reemplaza el conjunto de permisos de cada rol
 * modificado, uno por uno. Si el servicio rechaza un rol, ese conserva sus
 * cambios marcados y los demás quedan guardados: el fallo de uno no se lleva el
 * trabajo de los otros.
 *
 * Lo que se exporta es lo guardado, nunca el borrador. Por eso exportar espera
 * a que no haya cambios pendientes: la matriz aprobada (RBAC-06) debe coincidir
 * 1:1 con lo que la plataforma aplica.
 */
@Component({
  selector: 'medsys-access-matrix-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    ErrorState,
    TableSkeleton,
    Notice,
    ConfirmDialog,
    Select,
    Tooltip,
    RouterLink,
    Icon,
  ],
  templateUrl: './access-matrix-page.html',
  styleUrl: './access-matrix-page.scss',
})
export class AccessMatrixPage {
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly roles = this.access.rolesResource();
  protected readonly catalog = this.access.permissionsResource();
  protected readonly canManage = computed(() => can.manageRoles(this.session.permissions()));

  /* ------------------------------------------------------------ filtros -- */

  protected readonly term = signal('');
  protected readonly module = signal<string | null>(null);
  protected readonly onlySensitive = signal(false);
  protected readonly showInactive = signal(false);
  /** Un solo rol en columnas, cuando se llega desde su ficha. */
  protected readonly focusRole = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('rol'))),
    { initialValue: null },
  );
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly columns = computed(() => {
    const focus = this.focusRole();
    return orderRoles(this.roles.value() ?? []).filter((role) =>
      focus ? role.code === focus : role.active || this.showInactive(),
    );
  });

  protected readonly moduleOptions = computed(() =>
    groupByModule(this.catalog.value() ?? []).map((group) => ({
      value: group.module,
      label: `${group.label} (${group.permissions.length})`,
    })),
  );

  protected readonly groups = computed<readonly ModuleGroup[]>(() => {
    const needle = this.term().trim().toLowerCase();
    const module = this.module();
    const sensitive = this.onlySensitive();
    return groupByModule(this.catalog.value() ?? [])
      .filter((group) => module === null || group.module === module)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            (!sensitive || permission.sensitive) &&
            (needle === '' ||
              permission.code.includes(needle) ||
              permission.description.toLowerCase().includes(needle)),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  });

  protected readonly visibleCount = computed(() =>
    this.groups().reduce((total, group) => total + group.permissions.length, 0),
  );

  /* ---------------------------------------------------------- borrador -- */

  protected readonly saved = computed<Grid>(() => gridOf(this.roles.value() ?? []));

  /**
   * Lo marcado en pantalla. Al recargar los roles, cada rol cuyo guardado no
   * cambió conserva lo que se había marcado; el que sí cambió (porque se guardó,
   * o porque otra persona lo editó mientras tanto) vuelve a lo guardado.
   */
  protected readonly draft = linkedSignal<Grid, Grid>({
    source: this.saved,
    computation: (saved, previous) => {
      if (previous === undefined) {
        return saved;
      }
      return new Map(
        [...saved].map(([role, codes]) =>
          sameMembers(previous.source.get(role), codes)
            ? [role, previous.value.get(role) ?? codes]
            : [role, codes],
        ),
      );
    },
  });

  protected readonly changes = computed(() => changesBetween(this.saved(), this.draft()));
  protected readonly changeCount = computed(() =>
    this.changes().reduce(
      (total, change) => total + change.added.length + change.removed.length,
      0,
    ),
  );

  /** Por qué cada columna no se puede editar, o `null`. */
  protected readonly locks = computed(() => {
    const roles = this.session.roles();
    const permissions = this.session.permissions();
    return new Map(
      this.columns().map((role) => [role.code, roleEditLock(role, roles, permissions)]),
    );
  });

  /* ----------------------------------------------------------- guardado -- */

  protected readonly confirmingSave = signal(false);
  protected readonly saving = signal(false);
  protected readonly failures = signal<readonly SaveFailure[]>([]);

  protected readonly saveSummary = computed(() =>
    this.changes().map((change) => {
      const parts = [];
      if (change.added.length > 0) parts.push(`agrega ${change.added.length}`);
      if (change.removed.length > 0) parts.push(`quita ${change.removed.length}`);
      return `${change.role}: ${parts.join(' y ')}`;
    }),
  );

  protected column(code: string): string {
    return matrixColumn(code);
  }

  protected has(role: string, code: string): boolean {
    return this.draft().get(role)?.has(code) ?? false;
  }

  protected changed(role: string, code: string): boolean {
    return (this.saved().get(role)?.has(code) ?? false) !== this.has(role, code);
  }

  /** Por qué esta casilla no se puede marcar o desmarcar, o `null`. */
  protected cellLock(role: string, code: string): string | null {
    const lock = this.locks().get(role) ?? null;
    if (lock !== null) {
      return lock;
    }
    if (!this.has(role, code) && !canGrant(code, this.session.permissions())) {
      return 'Solo se agregan permisos que tú tienes.';
    }
    return null;
  }

  protected toggle(role: string, code: string, checked: boolean): void {
    this.draft.update((grid) => {
      const codes = new Set(grid.get(role));
      if (checked) {
        codes.add(code);
      } else {
        codes.delete(code);
      }
      return new Map(grid).set(role, codes);
    });
  }

  protected moduleState(role: string, permissions: readonly CatalogPermission[]): ModuleState {
    const held = permissions.filter((permission) => this.has(role, permission.code)).length;
    return held === 0 ? 'none' : held === permissions.length ? 'all' : 'some';
  }

  protected moduleCount(role: string, permissions: readonly CatalogPermission[]): string {
    const held = permissions.filter((permission) => this.has(role, permission.code)).length;
    return `${held}/${permissions.length}`;
  }

  /** Marca o desmarca de una vez lo visible del módulo, salvo lo que no se puede tocar. */
  protected toggleModule(
    role: string,
    permissions: readonly CatalogPermission[],
    checked: boolean,
  ): void {
    for (const permission of permissions) {
      if (
        this.has(role, permission.code) !== checked &&
        this.cellLock(role, permission.code) === null
      ) {
        this.toggle(role, permission.code, checked);
      }
    }
  }

  protected toggleCollapsed(module: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(module)) {
        next.add(module);
      }
      return next;
    });
  }

  protected clearFocus(): void {
    void this.router.navigate([], { queryParams: { rol: null }, queryParamsHandling: 'merge' });
  }

  protected discard(): void {
    this.draft.set(this.saved());
    this.failures.set([]);
  }

  protected async save(): Promise<void> {
    const changes = this.changes();
    const draft = this.draft();
    this.saving.set(true);
    const failures: SaveFailure[] = [];
    for (const change of changes) {
      try {
        await this.access.replacePermissions(change.role, [...(draft.get(change.role) ?? [])]);
      } catch (failure) {
        failures.push({ role: change.role, message: describeFailure(failure).message });
      }
    }
    this.saving.set(false);
    this.confirmingSave.set(false);
    this.failures.set(failures);
    this.roles.reload();

    const savedRoles = changes.length - failures.length;
    if (savedRoles > 0) {
      this.toasts.notify(
        `Permisos guardados en ${savedRoles} ${savedRoles === 1 ? 'rol' : 'roles'}. ` +
          'Rigen desde el próximo inicio de sesión de cada cuenta.',
      );
    }
  }

  /* --------------------------------------------------------- exportación -- */

  protected exportCsv(): void {
    const table = matrixTable(this.roles.value() ?? [], this.catalog.value() ?? []);
    // La marca de orden de bytes hace que Excel lea el CSV como UTF-8 y no rompa las tildes.
    this.download(
      new Blob(['﻿', toCsv(table)], { type: 'text/csv;charset=utf-8' }),
      `medicalsys-matriz-accesos-${todayIso()}.csv`,
    );
  }

  protected exportXlsx(): void {
    const roles = this.roles.value() ?? [];
    const matrix = matrixTable(roles, this.catalog.value() ?? []);
    const book = workbook([
      {
        name: 'Matriz',
        rows: matrix,
        widths: [24, 38, 52, 9, 10, ...matrix[0].slice(5).map(() => 16)],
      },
      { name: 'Roles', rows: rolesTable(roles), widths: [20, 30, 14, 10, 11, 10, 60] },
    ]);
    this.download(
      new Blob([book.slice().buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `medicalsys-matriz-accesos-${todayIso()}.xlsx`,
    );
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
