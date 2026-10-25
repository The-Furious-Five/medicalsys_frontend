import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../../core/ui/icon';
import { Role } from './access-control.models';
import { roleCategory, rolePurpose, searchText } from './access-presentation';

@Component({
  selector: 'medsys-role-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './role-picker.html',
  styleUrl: './role-picker.scss',
})
export class RolePicker {
  readonly roles = input.required<readonly Role[]>();
  readonly selectedCode = input<string | null>(null);
  readonly changedRoles = input<ReadonlySet<string>>(new Set());
  readonly roleSelected = output<string>();
  protected readonly rolePurpose = rolePurpose;
  protected readonly roleTerm = signal('');
  protected readonly category = signal('all');
  protected readonly ordered = computed(() => this.roles());
  protected readonly categories = [
    { value: 'all', label: 'Todos' },
    { value: 'care', label: 'Atención' },
    { value: 'administration', label: 'Gestión' },
  ] as const;
  protected readonly visibleRoles = computed(() => {
    const term = searchText(this.roleTerm());
    return this.roles().filter(
      (role) =>
        (this.category() === 'all' || roleCategory(role) === this.category()) &&
        (!term || searchText(role.name + ' ' + rolePurpose(role)).includes(term)),
    );
  });
  protected selectRole(code: string): void {
    this.roleSelected.emit(code);
  }
}
