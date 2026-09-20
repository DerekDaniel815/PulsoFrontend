import { Component, computed, signal } from '@angular/core';
import { GROUPS, LocationGroup } from './grupos.data';

@Component({
  selector: 'app-grupos',
  templateUrl: './grupos.html',
  styleUrl: './grupos.scss',
})
export class Grupos {
  protected readonly groups = signal(GROUPS);
  protected readonly groupsWithAccess = computed(
    () => this.groups().filter((group) => group.active).length,
  );

  protected toggleGroup(groupId: number): void {
    this.groups.update((groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, active: !group.active } : group)),
    );
  }

  protected onlineMembers(group: LocationGroup): number {
    return group.members.filter((member) => member.online).length;
  }
}
