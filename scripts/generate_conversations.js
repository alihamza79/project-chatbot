import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const CONVERSATION_TEMPLATES = [
  // Room Booking Templates
  {
    category: 'room_booking',
    templates: [
      {
        user: "I'd like to book a {roomType} for {numberOfGuests} people from {checkIn} to {checkOut}",
        bot: "I'd be happy to help you book a {roomType}. The rate is ${pricePerNight} per night. The room includes {amenities}. Would you like to proceed with the booking?",
        context: { intent: 'room_booking', stage: 'inquiry' }
      },
      {
        user: "What's the price for a {roomType} room?",
        bot: "The {roomType} room is ${pricePerNight} per night. It features {amenities}. Would you like to know about any specific amenities?",
        context: { intent: 'price_inquiry', stage: 'initial' }
      }
    ]
  },
  // Restaurant Booking Templates
  {
    category: 'restaurant_booking',
    templates: [
      {
        user: "I'd like to make a dinner reservation at {restaurantName} for {numberOfGuests} people on {date} at {time}",
        bot: "I'll help you book a table at {restaurantName}. We have {cuisine} cuisine, and our chef {chefName} specializes in {specialization}. Would you like to see the menu first?",
        context: { intent: 'restaurant_booking', stage: 'inquiry' }
      },
      {
        user: "What's on the menu at {restaurantName}?",
        bot: "Our current menu features: {menuItems}. Our most popular dish is {popularDish} with a rating of {popularityScore}. Would you like to make a reservation?",
        context: { intent: 'menu_inquiry', stage: 'initial' }
      }
    ]
  },
  // Spa Booking Templates
  {
    category: 'spa_booking',
    templates: [
      {
        user: "I'd like to book a {treatmentName} at the spa",
        bot: "The {treatmentName} is a {duration}-minute treatment priced at ${price}. It's one of our most popular treatments with a rating of {popularityScore}. When would you like to book?",
        context: { intent: 'spa_booking', stage: 'inquiry' }
      },
      {
        user: "What spa treatments do you offer?",
        bot: "Our Serenity Spa offers various treatments including: {treatments}. Our most popular treatment is {popularTreatment}. Would you like details about any specific treatment?",
        context: { intent: 'spa_inquiry', stage: 'initial' }
      }
    ]
  },
  // General Inquiry Templates
  {
    category: 'general_inquiry',
    templates: [
      {
        user: "What are your check-in and check-out times?",
        bot: "Our check-in time is from 3:00 PM, and check-out is until 11:00 AM. Early check-in and late check-out can be arranged based on availability. Would you like me to check this for specific dates?",
        context: { intent: 'timing_inquiry', stage: 'initial' }
      },
      {
        user: "Do you have any special offers currently?",
        bot: "Yes! We currently have the following special offers: {specialOffers}. Would you like more details about any of these offers?",
        context: { intent: 'offers_inquiry', stage: 'initial' }
      }
    ]
  }
];

async function generateConversations() {
  let client;
  try {
    client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('hotel-chatbot'); // Specify database name

    // Fetch hotel data with proper async/await
    const rooms = await db.collection('rooms').find().toArray();
    if (!rooms || rooms.length === 0) {
      throw new Error('No rooms found in database. Please run seed script first.');
    }

    const services = await db.collection('services').find().toArray();
    if (!services || services.length === 0) {
      throw new Error('No services found in database. Please run seed script first.');
    }

    const restaurants = services.filter(s => s.type === 'restaurant');
    const spas = services.filter(s => s.type === 'spa');

    const conversations = [];
    const totalConversations = 1000; // Adjust as needed

    for (let i = 0; i < totalConversations; i++) {
      const category = CONVERSATION_TEMPLATES[Math.floor(Math.random() * CONVERSATION_TEMPLATES.length)];
      const template = category.templates[Math.floor(Math.random() * category.templates.length)];

      let conversation = {
        id: `conv_${i}`,
        category: category.category,
        context: { ...template.context },
        messages: []
      };

      // Fill in template variables based on category
      let userMessage = template.user;
      let botMessage = template.bot;

      switch (category.category) {
        case 'room_booking': {
          const room = rooms[Math.floor(Math.random() * rooms.length)];
          userMessage = userMessage
            .replace('{roomType}', room.type)
            .replace('{numberOfGuests}', Math.floor(Math.random() * room.capacity) + 1)
            .replace('{checkIn}', new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .replace('{checkOut}', new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          
          botMessage = botMessage
            .replace('{roomType}', room.type)
            .replace('{pricePerNight}', room.pricePerNight)
            .replace('{amenities}', room.amenities.slice(0, 3).join(', '));
          break;
        }
        case 'restaurant_booking': {
          const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
          const menuItem = restaurant.menu[Math.floor(Math.random() * restaurant.menu.length)];
          userMessage = userMessage
            .replace('{restaurantName}', restaurant.name)
            .replace('{numberOfGuests}', Math.floor(Math.random() * 6) + 1)
            .replace('{date}', new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .replace('{time}', `${Math.floor(Math.random() * 5) + 18}:00`);
          
          botMessage = botMessage
            .replace('{restaurantName}', restaurant.name)
            .replace('{cuisine}', menuItem.cuisine || 'international')
            .replace('{chefName}', restaurant.staffMembers[0]?.name || 'our head chef')
            .replace('{specialization}', restaurant.staffMembers[0]?.specialization || 'fine dining')
            .replace('{menuItems}', restaurant.menu.map(item => item.name).join(', '))
            .replace('{popularDish}', menuItem.name)
            .replace('{popularityScore}', menuItem.popularityScore);
          break;
        }
        case 'spa_booking': {
          const spa = spas[Math.floor(Math.random() * spas.length)];
          const treatment = spa.menu[Math.floor(Math.random() * spa.menu.length)];
          userMessage = userMessage
            .replace('{treatmentName}', treatment.name);
          
          botMessage = botMessage
            .replace('{treatmentName}', treatment.name)
            .replace('{duration}', treatment.preparationTime)
            .replace('{price}', treatment.price)
            .replace('{popularityScore}', treatment.popularityScore)
            .replace('{treatments}', spa.menu.map(t => t.name).join(', '))
            .replace('{popularTreatment}', treatment.name);
          break;
        }
        case 'general_inquiry': {
          const allOffers = [...restaurants, ...spas]
            .flatMap(service => service.specialOffers || [])
            .filter(offer => offer.isActive)
            .map(offer => `${offer.name} (${offer.discount}% off)`);
          
          botMessage = botMessage
            .replace('{specialOffers}', allOffers.join(', ') || 'No current special offers');
          break;
        }
      }

      conversation.messages.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: botMessage }
      );

      conversations.push(conversation);
    }

    // Save conversations to a file
    const outputDir = join(dirname(__dirname), 'data');
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir);
    }

    await fs.writeFile(
      join(outputDir, 'synthetic_conversations.json'),
      JSON.stringify(conversations, null, 2)
    );

    console.log(`Generated ${conversations.length} conversations`);
  } catch (error) {
    console.error('Error generating conversations:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

generateConversations(); 