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
      { name: 'Mod1', nickname: 'mod1', email: 'mod1@test.com', phone: '+380000000001' },
      { name: 'Mod2', nickname: 'mod2', email: 'mod2@test.com', phone: '+380000000002' },
      { name: 'Mod3', nickname: 'mod3', email: 'mod3@test.com', phone: '+380000000003' },
    ];

    const users = [
      { name: 'Test1', nickname: 'test1', email: 'test1@test.com', phone: '+380000000011' },
      { name: 'Test2', nickname: 'test2', email: 'test2@test.com', phone: '+380000000012' },
      { name: 'Test3', nickname: 'test3', email: 'test3@test.com', phone: '+380000000013' },
    ];

    for (const mod of moderators) {
      await client.query(
        `INSERT INTO users (full_name, nickname, email, password_hash, role, phone_number) VALUES ($1, $2, $3, $4, 'MODERATOR', $5)`,
        [mod.name, mod.nickname, mod.email, hashedPassword, mod.phone]
      );
    }

    for (const u of users) {
      await client.query(
        `INSERT INTO users (full_name, nickname, email, password_hash, role, phone_number) VALUES ($1, $2, $3, $4, 'USER', $5)`,
        [u.name, u.nickname, u.email, hashedPassword, u.phone]
      );
    }

    console.log('✓ Inserted 3 moderators and 3 test users');
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
