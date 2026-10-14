import { resetDatabase } from './db.js';

/**
 * Wipes the database and re-creates the schema with fresh demo data.
 * Usage: npm run db:reset   (alias: npm run seed)
 */
export const seedDatabase = () => {
  resetDatabase();
  console.log('SQLite database reset: schema created and demo data seeded (password: password123).');
};

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('src/config/seed.js')) {
  seedDatabase();
}
