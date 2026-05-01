import pool from './config.js';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  const client = await pool.connect();

  try {
    console.log('Starting to seed database...');

    // Clear existing data
    await client.query('DELETE FROM event_participants');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM users');
    console.log('✓ Cleared existing data');

    // Insert sample users
    const usersData = [
      {
        phone: '+380981234567',
        name: 'Іван Петренко',
        nickname: 'ivan_games',
        age: 28,
        email: 'ivan@example.com',
        bio: 'Любитель настільних ігор та фантастики',
      },
      {
        phone: '+380987654321',
        name: 'Марія Коваленко',
        nickname: 'maria_board_games',
        age: 26,
        email: 'maria@example.com',
        bio: 'Організую місцеві турніри',
      },
      {
        phone: '+380965551234',
        name: 'Олег Сидоренко',
        nickname: 'oleg_player',
        age: 32,
        email: 'oleg@example.com',
        bio: 'Новачок у світі настільних ігор',
      },
      {
        phone: '+380675559876',
        name: 'Анна Бобченко',
        nickname: 'anna_dice_queen',
        age: 24,
        email: 'anna@example.com',
        bio: 'Люблю стратегічні ігри',
      },
      {
        phone: '+380505558765',
        name: 'Пётр Романенко',
        nickname: 'peter_collector',
        age: 35,
        email: 'peter@example.com',
        bio: 'Колекціонер рідких ігор',
      },
    ];

    const insertedUsers = [];
    for (const user of usersData) {
      const result = await client.query(
        `INSERT INTO users (phone_number, full_name, nickname, age, email, bio) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, phone_number, full_name, nickname`,
        [user.phone, user.name, user.nickname, user.age, user.email, user.bio]
      );
      insertedUsers.push(result.rows[0]);
    }
    console.log(`✓ Inserted ${insertedUsers.length} users`);

    // Insert sample events
    const eventsData = [
      {
        creatorId: insertedUsers[0].id,
        title: 'Турнір Catan - травень 2026',
        description: 'Офіційний турнір за настільною грою Catan. Приз для переможця!',
        location: 'Клуб "Дайс Таверна", вул. Хрещатик, 10, Київ',
        latitude: 50.4501,
        longitude: 30.5234,
        eventDate: new Date('2026-05-15T18:00:00'),
        maxParticipants: 16,
      },
      {
        creatorId: insertedUsers[1].id,
        title: 'Вечір легких ігор для новачків',
        description: 'Приватна зустріч для тих, хто тільки почає грати',
        location: 'Кафе "Гра", вул. Костельна, 5, Київ',
        latitude: 50.4502,
        longitude: 30.5235,
        eventDate: new Date('2026-05-10T19:00:00'),
        maxParticipants: 8,
      },
      {
        creatorId: insertedUsers[4].id,
        title: 'Презентація рідкої колекції',
        description: 'Покажу мою колекцію рідких настільних ігор з розповідями про кожну',
        location: 'Музей займищення, вул. Бульварно-Кудрявська, 1',
        latitude: 50.4503,
        longitude: 30.5236,
        eventDate: new Date('2026-05-20T17:00:00'),
        maxParticipants: 25,
      },
      {
        creatorId: insertedUsers[1].id,
        title: 'Марафон "Eldritch Horror" - 12 годин',
        description: 'Екстремальний марафон кооперативної гри. Потрібна витривалість!',
        location: 'Game Zone, вул. Костельна, 12, Київ',
        latitude: 50.4504,
        longitude: 30.5237,
        eventDate: new Date('2026-05-25T10:00:00'),
        maxParticipants: 6,
      },
      {
        creatorId: insertedUsers[2].id,
        title: 'Вивчаємо Глуміса вдвох',
        description: 'Давайте разом вивчимо правила та поіграємо у Gloomhaven',
        location: 'Квартира на Печерськ',
        latitude: 50.4505,
        longitude: 30.5238,
        eventDate: new Date('2026-05-12T20:00:00'),
        maxParticipants: 4,
      },
    ];

    const insertedEvents = [];
    for (const event of eventsData) {
      const result = await client.query(
        `INSERT INTO events (creator_id, title, description, location, latitude, longitude, event_date, max_participants) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, title, creator_id`,
        [
          event.creatorId,
          event.title,
          event.description,
          event.location,
          event.latitude,
          event.longitude,
          event.eventDate,
          event.maxParticipants,
        ]
      );
      insertedEvents.push(result.rows[0]);
    }
    console.log(`✓ Inserted ${insertedEvents.length} events`);

    // Insert sample event participants
    const participations = [
      { eventId: insertedEvents[0].id, userId: insertedUsers[1].id },
      { eventId: insertedEvents[0].id, userId: insertedUsers[2].id },
      { eventId: insertedEvents[0].id, userId: insertedUsers[3].id },
      { eventId: insertedEvents[1].id, userId: insertedUsers[0].id },
      { eventId: insertedEvents[1].id, userId: insertedUsers[3].id },
      { eventId: insertedEvents[2].id, userId: insertedUsers[0].id },
      { eventId: insertedEvents[2].id, userId: insertedUsers[1].id },
      { eventId: insertedEvents[3].id, userId: insertedUsers[0].id },
      { eventId: insertedEvents[3].id, userId: insertedUsers[3].id },
      { eventId: insertedEvents[4].id, userId: insertedUsers[1].id },
    ];

    for (const participation of participations) {
      await client.query(
        `INSERT INTO event_participants (event_id, user_id, status) VALUES ($1, $2, 'registered')`,
        [participation.eventId, participation.userId]
      );
    }
    console.log(`✓ Inserted ${participations.length} event registrations`);

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
