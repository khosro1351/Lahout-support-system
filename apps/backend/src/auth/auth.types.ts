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
  sessionId: string;
  csrfToken: string;
};
