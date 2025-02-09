import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please add your MongoDB URI to .env');
}

async function seedDatabase() {
  let client;
  try {
    client = await MongoClient.connect(uri);
    const db = client.db('hotel-chatbot');

    // Clear existing data
    await db.collection('rooms').deleteMany({});
    await db.collection('services').deleteMany({});
    await db.collection('reservations').deleteMany({});
    await db.collection('reviews').deleteMany({});

    // Create sample rooms
    const rooms = await db.collection('rooms').insertMany([
      {
        roomNumber: "101",
        type: "Deluxe Ocean View",
        capacity: 2,
        pricePerNight: 200,
        amenities: ["High-speed WiFi", "55-inch Smart TV", "Premium Mini Bar", "Ocean View Balcony", "Rain Shower", "Nespresso Machine"],
        features: ["King Size Bed", "Private Balcony", "Work Desk", "Lounge Area"],
        description: "Luxurious deluxe room with breathtaking ocean views and modern amenities",
        images: ["room101-1.jpg", "room101-2.jpg"],
        status: "Available",
        floor: 1,
        size: "45 sq m",
        bedType: "King",
        smoking: false,
        maintenance: {
          lastCleaned: new Date(),
          nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }
      },
      {
        roomNumber: "201",
        type: "Executive Suite",
        capacity: 4,
        pricePerNight: 350,
        amenities: ["High-speed WiFi", "65-inch Smart TV", "Premium Mini Bar", "Ocean View", "Jacuzzi", "Kitchen", "Wine Fridge"],
        features: ["2 King Beds", "Living Room", "Dining Area", "Office Space"],
        description: "Spacious suite perfect for families or business travelers",
        images: ["room201-1.jpg", "room201-2.jpg"],
        status: "Available",
        floor: 2,
        size: "75 sq m",
        bedType: "2 King",
        smoking: false,
        maintenance: {
          lastCleaned: new Date(),
          nextMaintenance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        }
      }
    ]);

    console.log('Rooms seeded successfully');

    // Create sample services
    const services = await db.collection('services').insertMany([
      {
        name: "Ocean View Restaurant",
        type: "restaurant",
        description: "Fine dining restaurant with panoramic ocean views",
        price: 0,
        availability: {
          days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          startTime: "07:00",
          endTime: "23:00",
          maxCapacity: 120,
          currentBookings: 0
        },
        location: {
          floor: 1,
          section: "East Wing",
          capacity: 120,
          tables: [
            { number: "A1", seats: 2, isAvailable: true },
            { number: "A2", seats: 4, isAvailable: true },
            { number: "B1", seats: 6, isAvailable: true }
          ]
        },
        menu: [
          {
            name: "Lobster Thermidor",
            description: "Fresh local lobster in classic thermidor sauce",
            price: 65,
            category: "main",
            cuisine: "international",
            spicyLevel: 1,
            dietaryInfo: ["gluten-free"],
            allergens: ["shellfish", "dairy"],
            preparationTime: 30,
            popularityScore: 4.8
          },
          {
            name: "Wagyu Beef Steak",
            description: "Grade A5 Japanese Wagyu with truffle sauce",
            price: 85,
            category: "main",
            cuisine: "international",
            spicyLevel: 0,
            allergens: [],
            preparationTime: 25,
            popularityScore: 4.9
          }
        ],
        specialOffers: [
          {
            name: "Sunday Brunch Special",
            description: "Unlimited champagne brunch with live music",
            discount: 20,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            isActive: true
          }
        ],
        staffMembers: [
          {
            name: "Chef Michael Chen",
            role: "Head Chef",
            specialization: "French Cuisine",
            availability: [
              { day: "monday", startTime: "14:00", endTime: "22:00" },
              { day: "tuesday", startTime: "14:00", endTime: "22:00" }
            ]
          }
        ],
        ratings: { average: 4.8, count: 156 },
        isActive: true,
        requirements: {
          advanceBooking: 2,
          minimumGuests: 1,
          maximumGuests: 10,
          dresscode: "Smart Casual"
        }
      },
      {
        name: "Serenity Spa",
        type: "spa",
        description: "Luxury spa offering traditional and modern treatments",
        price: 0,
        availability: {
          days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          startTime: "10:00",
          endTime: "20:00",
          maxCapacity: 15,
          currentBookings: 0
        },
        location: {
          floor: 3,
          section: "West Wing",
          capacity: 15
        },
        menu: [
          {
            name: "Royal Thai Massage",
            description: "90-minute traditional Thai massage",
            price: 150,
            category: "main",
            preparationTime: 90,
            popularityScore: 4.7
          },
          {
            name: "Couples Retreat Package",
            description: "3-hour spa experience for couples",
            price: 400,
            category: "special",
            preparationTime: 180,
            popularityScore: 4.9
          }
        ],
        staffMembers: [
          {
            name: "Sarah Johnson",
            role: "Lead Therapist",
            specialization: "Thai Massage",
            availability: [
              { day: "monday", startTime: "10:00", endTime: "18:00" },
              { day: "wednesday", startTime: "10:00", endTime: "18:00" }
            ]
          }
        ],
        ratings: { average: 4.9, count: 89 },
        isActive: true,
        requirements: {
          advanceBooking: 4,
          minimumGuests: 1,
          maximumGuests: 2,
          ageRestriction: 16
        }
      }
    ]);

    console.log('Services seeded successfully');

    // Create sample reservations with more details
    const reservations = await db.collection('reservations').insertMany([
      {
        guest: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          address: "123 Main St, New York, NY",
          preferences: {
            roomType: "Ocean View",
            floorPreference: "High floor",
            dietaryRestrictions: ["gluten-free"]
          }
        },
        room: rooms.insertedIds[0],
        checkIn: new Date("2024-03-01"),
        checkOut: new Date("2024-03-03"),
        numberOfGuests: 2,
        totalAmount: 400,
        status: "confirmed",
        paymentStatus: "paid",
        specialRequests: "Early check-in requested",
        bookings: [
          {
            service: services.insertedIds[0],
            date: new Date("2024-03-01"),
            time: "19:00",
            guests: 2,
            status: "confirmed"
          },
          {
            service: services.insertedIds[1],
            date: new Date("2024-03-02"),
            time: "14:00",
            guests: 2,
            status: "confirmed"
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // Create sample reviews with detailed feedback
    await db.collection('reviews').insertMany([
      {
        reservation: reservations.insertedIds[0],
        guest: {
          name: "John Doe",
          email: "john@example.com"
        },
        rating: 5,
        categories: {
          cleanliness: 5,
          service: 5,
          amenities: 4,
          location: 5,
          value: 4
        },
        content: "Exceptional stay! The ocean view from our room was breathtaking. Special thanks to the restaurant staff for accommodating our dietary requirements.",
        serviceReviews: [
          {
            service: services.insertedIds[0],
            rating: 5,
            comment: "The Wagyu steak was perfectly cooked. Chef Michael's recommendations were spot on."
          },
          {
            service: services.insertedIds[1],
            rating: 5,
            comment: "The couples spa treatment was incredibly relaxing. Sarah is a skilled therapist."
          }
        ],
        photos: ["review1-1.jpg", "review1-2.jpg"],
        hotelResponse: {
          comment: "Thank you for your wonderful feedback! We're delighted that you enjoyed your stay and our services.",
          respondedBy: "Hotel Manager",
          respondedAt: new Date()
        },
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

seedDatabase(); 