import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { ChatGroq } from '@langchain/groq';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { connectDB } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic'; // This is important for webhook endpoints
export const runtime = 'nodejs';

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 1024,
});

// Function to get real-time hotel data directly from MongoDB
async function getHotelData() {
  try {
    const { db } = await connectDB();
    
    // Get available rooms with all details
    const rooms = await db.collection('rooms').find({ status: "Available" }).toArray();
    console.log('Found rooms:', rooms);

    // Get active services
    const services = await db.collection('services').find({ isActive: true }).toArray();
    console.log('Found services:', services);

    if (!rooms || rooms.length === 0) {
      console.log('No rooms found in database');
      return {
        roomTypes: 'No rooms currently available',
        serviceList: '',
        specialOffers: ''
      };
    }

    // Format room types with comprehensive details
    const roomTypes = rooms.map(room => 
      `${room.type} (Room ${room.roomNumber}) - $${room.pricePerNight}/night
       Size: ${room.size}
       Bed: ${room.bedType}
       Floor: ${room.floor}
       Max Occupancy: ${room.capacity} guests
       Features: ${room.features ? room.features.map(f => f.name).join(', ') : 'Standard features'}
       Amenities: ${room.amenities.join(', ')}`
    ).join('\n\n- ');

    // Format services with their details
    const serviceList = services.map(service => 
      `${service.name} (${service.type})
       Hours: ${service.availability?.startTime || '00:00'} - ${service.availability?.endTime || '24:00'}
       Location: Floor ${service.location?.floor || 'G'}
       Description: ${service.description}`
    ).join('\n\n- ');

    // Get current special offers
    const now = new Date();
    const specialOffers = services.flatMap(service => 
      (service.specialOffers || [])
        .filter(offer => 
          offer.isActive && 
          (!offer.validUntil || new Date(offer.validUntil) > now) &&
          (!offer.validFrom || new Date(offer.validFrom) <= now)
        )
        .map(offer => 
          `${service.name}: ${offer.name}
           ${offer.description}
           Discount: ${offer.discount}% off
           Valid until: ${offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : 'No expiration'}`
        )
    ).join('\n\n- ');

    console.log('Processed hotel data:', { roomTypes, serviceList, specialOffers });

    return {
      roomTypes: roomTypes || 'No rooms currently available',
      serviceList: serviceList || 'No services currently available',
      specialOffers: specialOffers || 'No special offers currently available'
    };
  } catch (error) {
    console.error('Error fetching hotel data:', error);
    return {
      roomTypes: 'Error fetching room data',
      serviceList: 'Error fetching service data',
      specialOffers: 'Error fetching special offers'
    };
  }
}

// Enhanced prompt template with more natural language understanding
const hotelPrompt = PromptTemplate.fromTemplate(`
You are a friendly and professional hotel assistant. The guest has sent the following message:
{message}

Current Hotel Information (REAL-TIME DATA):

Available Rooms:
{roomTypes}

Our Services:
{serviceList}

Special Offers:
{specialOffers}

Booking format: Book: [name], [email], [check-in], [check-out], [room-type], [guests]

Instructions:
1. Respond naturally and helpfully. Keep responses concise but informative.
2. If they ask about booking, guide them to use the booking format.
3. If they ask about rooms, include pricing, amenities, and occupancy information.
4. If they ask about services, mention operating hours and location.
5. For special offers, include discount details and validity periods.
6. Always use the current real-time data provided above.
7. If they ask about availability for specific dates, encourage them to use the booking format to check.

Remember to be courteous and professional while maintaining a friendly tone.
`);

export async function GET(req) {
  return new NextResponse('Webhook endpoint is working!', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

export async function POST(req) {
  console.log('Received webhook request');
  try {
    const text = await req.text();
    console.log('Raw request body:', text);

    const formData = new URLSearchParams(text);
    const message = formData.get('Body');
    const from = formData.get('From');

    console.log('Processing message:', message);
    console.log('From:', from);

    // Get real-time hotel data directly from MongoDB
    const hotelData = await getHotelData();

    // Generate response using Groq LLM with real-time data
    const chain = hotelPrompt.pipe(llm).pipe(new StringOutputParser());
    const llmResponse = await chain.invoke({ 
      message,
      roomTypes: hotelData.roomTypes,
      serviceList: hotelData.serviceList,
      specialOffers: hotelData.specialOffers
    });
    console.log('LLM Response:', llmResponse);

    // Create Twilio response
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(llmResponse);

    const xmlResponse = twiml.toString();
    console.log('XML Response:', xmlResponse);

    return new NextResponse(xmlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Sorry, there was an error processing your request. Please try again.');
    
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
} 