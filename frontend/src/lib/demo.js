/** Seeded demo accounts (see backend/src/config/seedData.js). Every password is the same. */
export const DEMO_PASSWORD = 'password123'

export const DEMO_ACCOUNTS = [
  {
    role: 'Super Admin',
    name: 'Chief Super Admin',
    email: 'superadmin@allocate.habibullah.dev',
    description: 'Full control, including creating other admins and changing roles.',
  },
  {
    role: 'Admin',
    name: 'System Administrator',
    email: 'admin@allocate.habibullah.dev',
    description: 'Creates tasks, allocates work, approves registrations, views reports.',
  },
  {
    role: 'Employee',
    name: 'John Doe',
    email: 'john.doe@allocate.habibullah.dev',
    description: 'Senior backend developer with one task in progress.',
  },
  {
    role: 'Employee',
    name: 'Jane Smith',
    email: 'jane.smith@allocate.habibullah.dev',
    description: 'Lead designer with work waiting for review.',
  },
  {
    role: 'Employee',
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@allocate.habibullah.dev',
    description: 'Full-stack developer with free capacity.',
  },
]
