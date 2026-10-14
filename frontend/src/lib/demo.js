/** Seeded demo accounts (see backend/src/config/seedData.js). Every password is the same. */
export const DEMO_PASSWORD = 'password123'

export const DEMO_ACCOUNTS = [
  {
    role: 'Super Admin',
    name: 'Chief Super Admin',
    email: 'superadmin@smartworkflow.org',
    description: 'Full control, including creating other admins and changing roles.',
  },
  {
    role: 'Admin',
    name: 'System Administrator',
    email: 'admin@smartworkflow.org',
    description: 'Creates tasks, allocates work, approves registrations, views reports.',
  },
  {
    role: 'Employee',
    name: 'John Doe',
    email: 'john.doe@smartworkflow.org',
    description: 'Senior backend developer with one task in progress.',
  },
  {
    role: 'Employee',
    name: 'Jane Smith',
    email: 'jane.smith@smartworkflow.org',
    description: 'Lead designer with work waiting for review.',
  },
  {
    role: 'Employee',
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@smartworkflow.org',
    description: 'Full-stack developer with free capacity.',
  },
]
