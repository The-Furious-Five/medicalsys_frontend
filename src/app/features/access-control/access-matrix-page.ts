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
import { ToastService } from '../../core/toast/toast.service';
import { Icon } from '../../core/ui/icon';
import { Dialog } from '../../shared/dialog';
import { Select } from '../../shared/select';
import { Skeleton } from '../../shared/skeleton';
import { CatalogPermission } from './access-control.models';
import { AccessControlService } from './access-control.service';
import { Grid, changesBetween, gridOf, orderRoles, toCsv } from './access-matrix';
import {
  AccessArea,
  accessAreas,
  accessFailure,
  permissionHint,
  permissionLabel,
  roleIcon,
  roleName,
  rolePurpose,
  searchText,
} from './access-presentation';
import { canGrant, roleEditLock } from './access-rules';
import { NewRoleSheet } from './new-role-sheet';
import { RolePicker } from './role-picker';
import { RoleComparison } from './role-comparison';
import { workbook } from './xlsx';

type View = 'access' | 'compare';
interface SaveFailure {
  readonly role: string;
  readonly message: string;
}
const sameMembers = (a: ReadonlySet<string> | undefined, b: ReadonlySet<string> | undefined) =>
  (a?.size ?? 0) === (b?.size ?? 0) && [...(a ?? [])].every((code) => b?.has(code));

@Component({
  selector: 'medsys-access-matrix-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, Select, Skeleton, RouterLink, Icon, NewRoleSheet, RolePicker, RoleComparison],
  templateUrl: './access-matrix-page.html',
  styleUrl: './access-matrix-page.scss',
  host: { class: 'access-feature', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class AccessMatrixPage {
  private readonly access = inject(AccessControlService);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly roles = this.access.rolesResource();
  protected readonly catalog = this.access.permissionsResource();
  protected readonly ordered = computed(() => orderRoles(this.roles.value() ?? []));
  protected readonly canManage = computed(() => can.manageRoles(this.session.permissions()));
  protected readonly canViewPeople = computed(() =>
    can.viewRoleAssignments(this.session.permissions()),
  );
  protected readonly permissionLabel = permissionLabel;
  protected readonly permissionHint = permissionHint;
  protected readonly rolePurpose = rolePurpose;
  protected readonly roleIcon = roleIcon;
  protected readonly nameOfRole = (code: string) => roleName(code, this.ordered());
  protected readonly term = signal('');
  protected readonly accessFilter = signal('all');
  protected readonly showOtherAreas = signal(false);
  protected readonly filterOptions = [
    { value: 'all', label: 'Todas las funciones' },
    { value: 'allowed', label: 'Con acceso' },
    { value: 'denied', label: 'Sin acceso' },
  ];
  protected readonly creating = signal(false);
  protected readonly activeArea = signal('clinical');
  protected readonly expandedAreas = signal<ReadonlySet<string>>(new Set());
  protected readonly focusRole = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('rol'))),
    { initialValue: this.route.snapshot.queryParamMap.get('rol') },
  );
  protected readonly selectedCode = linkedSignal(() => this.focusRole() ?? 'PHYSICIAN');
  private readonly requestedView = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('vista'))),
    { initialValue: this.route.snapshot.queryParamMap.get('vista') },
  );
  protected readonly view = linkedSignal<View>(() =>
    this.requestedView() === 'comparar' ||
    this.route.snapshot.routeConfig?.path === 'matriz-accesos'
      ? 'compare'
      : 'access',
  );
  protected readonly selected = computed(
    () =>
      this.ordered().find((role) => role.code === this.selectedCode()) ?? this.ordered()[0] ?? null,
  );
  protected readonly roleOptions = computed(() =>
    this.ordered().map((role) => ({
      value: role.code,
      label: role.name + (role.active ? '' : ' · Inactivo'),
    })),
  );

  private readonly saved = computed<Grid>(() => gridOf(this.roles.value() ?? []));
  protected readonly draft = linkedSignal<Grid, Grid>({
    source: this.saved,
    computation: (saved, previous) =>
      previous === undefined
        ? saved
        : new Map(
            [...saved].map(([role, codes]) =>
              sameMembers(previous.source.get(role), codes)
                ? [role, previous.value.get(role) ?? codes]
                : [role, codes],
            ),
          ),
  });
  protected readonly changes = computed(() => changesBetween(this.saved(), this.draft()));
  protected readonly changeCount = computed(() =>
    this.changes().reduce(
      (total, change) => total + change.added.length + change.removed.length,
      0,
    ),
  );
  protected readonly changedRoles = computed(
    () => new Set(this.changes().map((change) => change.role)),
  );
  protected readonly areas = computed(() => accessAreas(this.catalog.value() ?? []));
  private readonly matchingGroups = computed(() => {
    const code = this.selected()?.code;
    const term = searchText(this.term());
    return this.areas()
      .map((area) => ({
        ...area,
        permissions: area.permissions.filter(
          (permission) =>
            (!term || searchText(area.name + ' ' + permissionLabel(permission)).includes(term)) &&
            (this.accessFilter() === 'all' ||
              this.has(code ?? '', permission.code) === (this.accessFilter() === 'allowed')),
        ),
      }))
      .filter((area) => area.permissions.length > 0);
  });
  protected readonly groups = computed(() => {
    const groups = this.matchingGroups();
    const role = this.selected();
    if (
      !role ||
      this.showOtherAreas() ||
      this.term().trim() ||
      this.accessFilter() === 'denied' ||
      !this.draft().get(role.code)?.size
    )
      return groups;
    return groups.filter(
      (area) =>
        this.allowed(area, role.code) > 0 ||
        area.permissions.some((permission) => this.changed(role.code, permission.code)),
    );
  });
  protected readonly hiddenAreas = computed(
    () => this.matchingGroups().length - this.groups().length,
  );
  protected readonly selectedLock = computed(() => {
    const role = this.selected();
    if (!role || !this.canManage())
      return 'Puedes consultar estos accesos. Su modificación corresponde al personal autorizado.';
    if (this.session.roles().includes(role.code))
      return 'Estás usando este rol. Otra persona autorizada debe revisar sus accesos.';
    return roleEditLock(role, this.session.roles(), this.session.permissions())
      ? 'No tienes autorización para modificar los accesos de este rol.'
      : null;
  });
  protected readonly review = computed(() =>
    this.changes().map((change) => ({
      name: roleName(change.role, this.ordered()),
      added: change.added.map((code) => this.labelFor(code)),
      removed: change.removed.map((code) => this.labelFor(code)),
    })),
  );
  protected readonly confirmingSave = signal(false);
  protected readonly saving = signal(false);
  protected readonly failures = signal<readonly SaveFailure[]>([]);
  protected readonly leaving = signal(false);
  private leaveResolver: ((leave: boolean) => void) | null = null;

  protected onViewKey(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const view: View =
      event.key === 'Home'
        ? 'access'
        : event.key === 'End'
          ? 'compare'
          : this.view() === 'access'
            ? 'compare'
            : 'access';
    this.changeView(view);
    document.getElementById(view === 'access' ? 'access-tab' : 'compare-tab')?.focus();
  }
  protected selectRole(code: string): void {
    this.selectedCode.set(code);
    this.failures.set([]);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { rol: code },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected changeView(view: View): void {
    this.view.set(view);
  }
  protected has(role: string, code: string): boolean {
    return this.draft().get(role)?.has(code) ?? false;
  }
  protected changed(role: string, code: string): boolean {
    return (this.saved().get(role)?.has(code) ?? false) !== this.has(role, code);
  }
  protected allowed(area: AccessArea, role: string): number {
    return area.permissions.filter((permission) => this.has(role, permission.code)).length;
  }
  protected areaState(area: AccessArea, role: string): string {
    const source = this.areas().find((entry) => entry.id === area.id) ?? area;
    const held = this.allowed(source, role);
    return held === 0 ? 'Sin acceso' : 'Con acceso';
  }
  protected areaOpen(id: string): boolean {
    return this.term().trim().length > 0 || this.activeArea() === id;
  }
  protected toggleArea(id: string): void {
    this.activeArea.set(this.activeArea() === id ? '' : id);
  }
  protected areaPermissions(area: AccessArea): readonly CatalogPermission[] {
    return this.term().trim() || this.expandedAreas().has(area.id)
      ? area.permissions
      : area.permissions.slice(0, 5);
  }
  protected expandArea(id: string): void {
    this.expandedAreas.update((areas) => new Set(areas).add(id));
  }
  protected canToggle(permission: CatalogPermission): boolean {
    const role = this.selected();
    return (
      !!role &&
      this.selectedLock() === null &&
      !this.saving() &&
      (this.has(role.code, permission.code) ||
        canGrant(permission.code, this.session.permissions()))
    );
  }
  protected toggle(permission: CatalogPermission): void {
    const role = this.selected();
    if (!role || !this.canToggle(permission)) return;
    this.draft.update((grid) => {
      const codes = new Set(grid.get(role.code));
      if (!codes.delete(permission.code)) codes.add(permission.code);
      return new Map(grid).set(role.code, codes);
    });
  }
  protected discard(): void {
    if (!this.saving()) {
      this.draft.set(this.saved());
      this.failures.set([]);
    }
  }
  protected async save(): Promise<void> {
    if (this.saving()) return;
    const changes = this.changes();
    const draft = this.draft();
    this.saving.set(true);
    const failures: SaveFailure[] = [];
    for (const change of changes) {
      try {
        await this.access.replacePermissions(change.role, [...(draft.get(change.role) ?? [])]);
      } catch (failure) {
        failures.push({
          role: change.role,
          message: accessFailure(failure, this.ordered(), this.catalog.value() ?? []),
        });
      }
    }
    this.failures.set(failures);
    this.confirmingSave.set(false);
    this.saving.set(false);
    this.roles.reload();
    const count = changes.length - failures.length;
    if (count > 0)
      this.toasts.notify(
        count === 1 ? 'Accesos del rol guardados.' : `Accesos guardados en ${count} roles.`,
      );
  }
  protected labelFor(code: string): string {
    const permission = (this.catalog.value() ?? []).find((entry) => entry.code === code);
    return permission ? permissionLabel(permission) : 'Función adicional';
  }
  protected exportSummary(format: 'xlsx' | 'csv'): void {
    if (this.changeCount() || !this.roles.hasValue() || !this.catalog.hasValue()) return;
    const roles = this.ordered();
    const rows = [
      ['Área', 'Función', ...roles.map((role) => role.name)],
      ...this.areas().flatMap((area) =>
        area.permissions.map((permission) => [
          area.name,
          permissionLabel(permission),
          ...roles.map((role) =>
            this.has(role.code, permission.code) ? 'Permitido' : 'Sin acceso',
          ),
        ]),
      ),
    ];
    const data =
      format === 'xlsx'
        ? workbook([
            { name: 'Accesos por rol', rows, widths: [28, 54, ...roles.map(() => 25)] },
          ]).slice().buffer
        : '\ufeff' + toCsv(rows);
    const blob = new Blob([data], {
      type:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medicalsys-accesos-${todayIso()}.${format}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  requestLeave(): boolean | Promise<boolean> {
    if (!this.changeCount()) return true;
    if (this.saving()) return false;
    this.leaving.set(true);
    return new Promise((resolve) => {
      this.leaveResolver = resolve;
    });
  }
  protected resolveLeave(leave: boolean): void {
    if (leave) this.discard();
    this.leaving.set(false);
    this.leaveResolver?.(leave);
    this.leaveResolver = null;
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.changeCount()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
