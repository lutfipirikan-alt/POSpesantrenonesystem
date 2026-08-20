/* ===== Audit trail — append-only, tidak dapat dihapus dari UI kasir ===== */

import type { Role } from '../types';
import { uid, todayISO } from '../util';
import { db, mutate } from '../store';

export function audit(
  actor: { id: string; name: string; role: Role } | null,
  action: string,
  entity: string,
  entityId: string,
  details: string
): void {
  mutate((d) => {
    d.audits.unshift({
      id: uid('AUD'),
      userId: actor?.id ?? 'SYSTEM',
      userName: actor?.name ?? 'Sistem',
      role: actor?.role ?? 'SUPER_ADMIN',
      action,
      entity,
      entityId,
      details,
      createdAt: todayISO(),
    });
    if (d.audits.length > 1200) d.audits.length = 1200;
  });
}

export function auditReadonlyNote(): string {
  return `Audit log bersifat append-only. ${db.audits.length} entri tersimpan.`;
}
