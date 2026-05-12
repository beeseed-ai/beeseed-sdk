export const MOCK_APP_USERS = [
  {
    id: 'user-001',
    email: 'owner@t.com',
    name: 'App Owner',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=owner',
    role: 'owner' as const,
    is_disabled: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'user-002',
    email: 'admin1@t.com',
    name: 'Admin One',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin1',
    role: 'admin' as const,
    is_disabled: false,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z'
  },
  {
    id: 'user-003',
    email: 'admin2@t.com',
    name: 'Admin Two (Disabled)',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin2',
    role: 'admin' as const,
    is_disabled: true,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'user-004',
    email: 'member1@t.com',
    name: 'Member One',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member1',
    role: 'member' as const,
    is_disabled: false,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z'
  },
  {
    id: 'user-005',
    email: 'member2@t.com',
    name: 'Member Two (Disabled)',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member2',
    role: 'member' as const,
    is_disabled: true,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z'
  }
]

export const MOCK_INVITES = [
  {
    id: 'inv-001',
    token_prefix: 'beeseed',
    code: 'BEESEED2026',
    created_by: 'user-002',
    created_at: '2026-05-10T00:00:00Z',
    expires_at: '2026-06-10T00:00:00Z'
  },
  {
    id: 'inv-002',
    token_prefix: 'testinv',
    code: 'TESTINVITE1',
    created_by: 'user-001',
    created_at: '2026-05-01T00:00:00Z',
    expires_at: '2026-05-08T00:00:00Z'
  },
  {
    id: 'inv-003',
    token_prefix: 'revoked',
    created_by: 'user-002',
    created_at: '2026-05-11T00:00:00Z',
    expires_at: '2026-06-11T00:00:00Z',
    revoked_at: '2026-05-11T12:00:00Z'
  },
  {
    id: 'inv-004',
    token_prefix: 'usedcod',
    created_by: 'user-001',
    created_at: '2026-04-01T00:00:00Z',
    expires_at: '2026-05-01T00:00:00Z',
    used_at: '2026-04-15T00:00:00Z',
    used_by: 'user-004'
  }
]