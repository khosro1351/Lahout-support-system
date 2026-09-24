export type RoleAssignment = {
  roleCode: string;
  scopeType: 'ORGANIZATION' | 'GROUP';
  scopeId: string | null;
};

export type AuthUser = {
  accountId: string;
  personId: string;
  displayName: string;
  username: string;
  roles: RoleAssignment[];
  availableRoles: RoleAssignment[];
  effectiveRole: string | null;
  simulation: boolean;
  redirectTo: string;
  sessionId: string;
  csrfToken: string;
};
