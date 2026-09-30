import type { Participant, Role } from '../types/domain';

/** One instrument and one vocal duty per member; guitar + singing is allowed.
 * Augmenting-path matching prevents one multi-instrumentalist filling two instruments.
 * Scarcer roles are considered first; duplicates never replace a missing role.
 */
export function assignRoles(group: Participant[], desired: Role[], weights: Partial<Record<Role, number>> = {}): { role: Role; participantId: string }[] {
  const owners = new Map<string, Role>();
  const vocal = (r: Role) => r === 'lead_vocal' || r === 'backing_vocal';
  const visit = (role: Role, seen: Set<string>): boolean => {
    for (const member of group) {
      if (!member.capabilities?.includes(role)) continue;
      const slot = `${member.id}:${vocal(role) ? 'voice' : 'instrument'}`;
      if (seen.has(slot)) continue;
      seen.add(slot);
      const previous = owners.get(slot);
      if (!previous || visit(previous, seen)) {
        owners.set(slot, role);
        return true;
      }
    }
    return false;
  };
  for (const role of [...new Set(desired)].sort((a, b) => (weights[b] ?? 1) - (weights[a] ?? 1))) {
    visit(role, new Set());
  }
  return [...owners].map(([slot, role]) => ({ role, participantId: slot.slice(0, slot.lastIndexOf(':')) }));
}
