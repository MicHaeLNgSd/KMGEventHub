import pool from './config.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const seedData = async () => {
  const client = await pool.connect();

  try {
    console.log('Starting to seed database...');

    // Clear existing data
    await client.query('TRUNCATE users, events, event_participants, messages CASCADE');
    console.log('✓ Cleared all existing data');

    const hashedPassword = await bcrypt.hash('123456', 10);

    const moderators = [
      { name: 'Mod1', nickname: 'mod1', email: 'mod1@test.com' },
      { name: 'Mod2', nickname: 'mod2', email: 'mod2@test.com' },
      { name: 'Mod3', nickname: 'mod3', email: 'mod3@test.com' },
    ];

    for (const mod of moderators) {
      await client.query(
        `INSERT INTO users (full_name, nickname, email, password_hash, role) VALUES ($1, $2, $3, $4, 'MODERATOR')`,
        [mod.name, mod.nickname, mod.email, hashedPassword]
      );
    }

    console.log('✓ Inserted 3 moderators');
    console.log('\n✅ Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seedData();
