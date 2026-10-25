import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Role } from './access-control.models';
import { Grid } from './access-matrix';
import { AccessArea, permissionLabel } from './access-presentation';
import { Select } from '../../shared/select';
import { Icon } from '../../core/ui/icon';

@Component({
  selector: 'medsys-role-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Select, Icon],
  templateUrl: './role-comparison.html',
  styleUrl: './role-comparison.scss',
})
export class RoleComparison {
  readonly roles = input.required<readonly Role[]>();
  readonly areas = input.required<readonly AccessArea[]>();
  readonly grants = input.required<Grid>();
  readonly selectedRole = input<string | null>(null);
  protected readonly permissionLabel = permissionLabel;
  protected readonly ordered = computed(() => this.roles());
  protected readonly roleOptions = computed(() =>
    this.roles().map((role) => ({ value: role.code, label: role.name })),
  );
  protected readonly compareCodes = signal<readonly string[]>([]);
  protected readonly differencesOnly = signal(true);
  protected readonly expandedComparison = signal<ReadonlySet<string>>(new Set());
  protected readonly compared = computed(() => {
    const requested = this.compareCodes();
    const defaults = [
      this.selectedRole(),
      'RECEPTIONIST',
      ...this.roles().map((role) => role.code),
    ];
    const codes = requested.length
      ? requested
      : [...new Set(defaults.filter((code): code is string => !!code))].slice(0, 2);
    return codes
      .map((code) => this.roles().find((role) => role.code === code))
      .filter((role): role is Role => !!role);
  });
  protected readonly comparison = computed(() =>
    this.areas()
      .map((area) => ({
        ...area,
        permissions: area.permissions.filter(
          (permission) =>
            !this.differencesOnly() ||
            new Set(this.compared().map((role) => this.has(role.code, permission.code))).size > 1,
        ),
      }))
      .filter((area) => area.permissions.length > 0),
  );

  protected has(role: string, code: string): boolean {
    return this.grants().get(role)?.has(code) ?? false;
  }
  protected allowed(area: AccessArea, role: string): number {
    return area.permissions.filter((permission) => this.has(role, permission.code)).length;
  }
  protected comparisonOptions(index: number) {
    const selected = this.compared().map((role) => role.code);
    return this.roleOptions().filter(
      (option) => option.value === selected[index] || !selected.includes(option.value),
    );
  }
  protected changeCompared(index: number, code: string): void {
    if (!code) return;
    const codes = this.compared().map((role) => role.code);
    if (codes.some((entry, position) => position !== index && entry === code)) return;
    codes[index] = code;
    this.compareCodes.set(codes);
  }
  protected addCompared(): void {
    const codes = this.compared().map((role) => role.code);
    const next = this.roles().find((role) => !codes.includes(role.code));
    if (next && codes.length < 3) this.compareCodes.set([...codes, next.code]);
  }
  protected removeCompared(index: number): void {
    this.compareCodes.set(
      this.compared()
        .filter((_, position) => position !== index)
        .map((role) => role.code),
    );
  }
  protected toggleComparison(id: string): void {
    this.expandedComparison.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}
