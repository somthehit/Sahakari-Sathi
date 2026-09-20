/**
 * RBAC Permission Catalog
 * Shared between backend (validation) and frontend (permission drawer).
 */
export const PERMISSION_CATEGORIES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'members', label: 'Members' },
  { key: 'savings', label: 'Savings' },
  { key: 'loans', label: 'Loans' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'shares', label: 'Shares' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'hr', label: 'HR' },
  { key: 'reports', label: 'Reports' },
  { key: 'admin', label: 'Admin' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit', label: 'Audit' },
] as const;

export const PERMISSION_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
  { key: 'export', label: 'Export' },
  { key: 'print', label: 'Print' },
  { key: 'assign', label: 'Assign' },
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]['key'];
export type PermissionKey = (typeof PERMISSION_CATEGORIES)[number]['key'];

/** A grant row: category + key + action + granted. */
export interface PermissionGrant {
  category: string;
  key: string;
  action: string;
  granted: boolean;
}

/** Matrix shaped { [categoryKey]: { [action]: boolean } }. */
export type PermissionMatrix = Record<string, Record<string, boolean>>;

export const emptyPermissionMatrix = (): PermissionMatrix =>
  Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c.key, Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a.key, false]))]));

/** Convert stored grant rows into the matrix shape. */
export const grantsToMatrix = (grants: PermissionGrant[]): PermissionMatrix => {
  const matrix = emptyPermissionMatrix();
  for (const g of grants) {
    if (matrix[g.key]) matrix[g.key][g.action] = !!g.granted;
  }
  return matrix;
};

/** Convert the matrix back into grant rows (granted only). */
export const matrixToGrants = (matrix: PermissionMatrix): PermissionGrant[] => {
  const rows: PermissionGrant[] = [];
  for (const [key, actions] of Object.entries(matrix)) {
    const cat = PERMISSION_CATEGORIES.find((c) => c.key === key);
    for (const [action, granted] of Object.entries(actions)) {
      if (granted) {
        rows.push({ category: cat?.label ?? key, key, action, granted: true });
      }
    }
  }
  return rows;
};
