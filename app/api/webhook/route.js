import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { ChatGroq } from '@langchain/groq';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { connectDB } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { pipeline, readAudio } from '@xenova/transformers';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const dynamic = 'force-dynamic'; // This is important for webhook endpoints
export const runtime = 'nodejs';
export const maxDuration = 60; // Set max duration to 60 seconds (Vercel hobby plan limit)

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 1024,
});

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

let whisperPipeline = null;

async function getWhisperPipeline() {
  if (!whisperPipeline) {
    console.log('🔄 Initializing Whisper pipeline...');
    try {
      whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
        revision: 'main',
        quantized: true,
        task: 'transcribe',
        cache_dir: './models/cache',
        local_files_only: false
      });
      console.log('✅ Whisper pipeline initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Whisper pipeline:', error);
      throw error;
    }
  }
  return whisperPipeline;
}

async function transcribeVoiceMessage(audioUrl) {
  console.log('\n🎤 Processing Voice Message 🎤');
  console.log('Audio URL:', audioUrl);
  
  const startTime = Date.now();
  // Create temporary file paths for OGG and WAV files
  const tempOggPath = join(tmpdir(), `audio_${Date.now()}.ogg`);
  const tempWavPath = join(tmpdir(), `audio_${Date.now()}.wav`);
  
  try {
    // Fetch audio with authentication
    console.log('📥 Fetching audio file...');
    const authString = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(audioUrl, {
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    // Get audio data as ArrayBuffer and save it as an OGG file
    const audioBuffer = await response.arrayBuffer();
    await writeFile(tempOggPath, Buffer.from(audioBuffer));
    console.log(`💾 Saved OGG file: ${tempOggPath}`);
    
    // Convert OGG file to WAV using ffmpeg
    console.log('🔄 Converting OGG to WAV using ffmpeg...');
    const ffmpegCmd = `ffmpeg -y -i "${tempOggPath}" -ac 1 -ar 16000 "${tempWavPath}"`;
    await execPromise(ffmpegCmd);
    console.log(`✅ Conversion completed. WAV file: ${tempWavPath}`);
    
    // Read WAV file buffer
    const wavBuffer = await readFile(tempWavPath);
    
    // Parse WAV header (assume 44 bytes) and extract PCM data
    const pcmData = wavBuffer.slice(44);
    const sampleCount = pcmData.length / 2;
    const audioData = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const sample = pcmData.readInt16LE(i * 2);
      audioData[i] = sample / 32768.0; // Normalize to range [-1, 1]
    }
    
    // Get Whisper pipeline
    console.log('🤖 Getting Whisper pipeline...');
    const whisper = await getWhisperPipeline();
    
    // Transcribe using the raw PCM data
    console.log('🎯 Starting transcription...');
    const result = await whisper(audioData, {
      sampling_rate: 16000,
      task: 'transcribe',
      language: 'en'
    });
    
    if (!result?.text) {
      throw new Error('No transcription output received');
    }
    
    const transcriptionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n✨ Transcription Results ✨');
    console.log('Time taken:', transcriptionTime, 'seconds');
    console.log('Transcript:', result.text);
    
    return result.text;
  } catch (error) {
    console.error('\n❌ Transcription Error ❌');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    // Cleanup temporary files
    try {
      await unlink(tempOggPath);
      console.log(`🧹 Deleted temporary OGG file: ${tempOggPath}`);
    } catch (e) {
      console.error('⚠️ Error deleting OGG file:', e);
    }
    try {
      await unlink(tempWavPath);
      console.log(`🧹 Deleted temporary WAV file: ${tempWavPath}`);
    } catch (e) {
      console.error('⚠️ Error deleting WAV file:', e);
    }
  }
}

// Function to handle room booking
async function handleBooking(bookingDetails) {
  try {
    const { db } = await connectDB();
    
    // Parse booking details
    const [name, email, checkIn, checkOut, roomType, guests] = bookingDetails;
    const guestsCount = parseInt(guests);

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

    if (checkInDate < now) {
      return { success: false, message: "Check-in date cannot be in the past." };
    }
    if (checkOutDate <= checkInDate) {
      return { success: false, message: "Check-out date must be after check-in date." };
    }

    // Find available room of requested type
    const rooms = await db.collection('rooms').find({
      type: { $regex: new RegExp(roomType, 'i') },
      capacity: { $gte: guestsCount }
    }).toArray();

    if (!rooms || rooms.length === 0) {
      return { 
        success: false, 
        message: `Sorry, no ${roomType} rooms available for ${guestsCount} guests. Would you like to check other room types?` 
      };
    }

    // Find a room without overlapping reservations
    let availableRoom = null;
    for (const room of rooms) {
      const existingReservation = await db.collection('reservations').findOne({
        room: room._id,
        status: { $nin: ['cancelled'] },
        $or: [
          { checkIn: { $lt: checkOutDate, $gte: checkInDate } },
          { checkOut: { $gt: checkInDate, $lte: checkOutDate } }
        ]
      });

      if (!existingReservation) {
        availableRoom = room;
        break;
      }
    }

    if (!availableRoom) {
      return { 
        success: false, 
        message: `Sorry, no ${roomType} rooms available for the selected dates. Would you like to check different dates or room types?` 
      };
    }

    // Calculate total amount
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalAmount = availableRoom.pricePerNight * nights;

    // Create reservation
    const reservation = {
      guest: {
        name,
        email,
        phone: '', // Can be updated later
        specialRequests: ''
      },
      room: availableRoom._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      numberOfGuests: guestsCount,
      totalAmount,
      status: 'confirmed',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('reservations').insertOne(reservation);

    // Update room status
    await db.collection('rooms').updateOne(
      { _id: availableRoom._id },
      { $set: { status: 'reserved' } }
    );

    return {
      success: true,
      message: `Booking confirmed!\n\nDetails:\n- Room: ${availableRoom.type} (Room ${availableRoom.roomNumber})\n- Check-in: ${checkIn}\n- Check-out: ${checkOut}\n- Total: $${totalAmount}\n\nA confirmation email will be sent to ${email}. For special requests or to add services to your booking, please let me know.`,
      reservationId: result.insertedId
    };
  } catch (error) {
    console.error('Error processing booking:', error);
    return {
      success: false,
      message: "Sorry, there was an error processing your booking. Please try again or contact our support."
    };
  }
}

// Function to handle service booking
async function handleServiceBooking(serviceType, date, time, guests, email) {
  try {
    const { db } = await connectDB();

    // Find the requested service
    const service = await db.collection('services').findOne({
      type: { $regex: new RegExp(serviceType, 'i') },
      isActive: true
    });

    if (!service) {
      return {
        success: false,
        message: `Sorry, the requested ${serviceType} service is not available.`
      };
    }

    // Validate service availability
    const bookingDate = new Date(`${date}T${time}`);
    const bookingDay = bookingDate.toLocaleLowerCase('en-US', { weekday: 'long' });

    if (!service.availability.days.includes(bookingDay)) {
      return {
        success: false,
        message: `Sorry, ${service.name} is not available on ${bookingDay}s.`
      };
    }

    // Check service capacity
    if (service.availability.maxCapacity && guests > service.availability.maxCapacity) {
      return {
        success: false,
        message: `Sorry, maximum capacity for ${service.name} is ${service.availability.maxCapacity} guests.`
      };
    }

    // Create service booking
    const serviceBooking = {
      service: service._id,
      date: bookingDate,
      guests: parseInt(guests),
      email,
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('serviceBookings').insertOne(serviceBooking);

    return {
      success: true,
      message: `Service booking confirmed!\n\nDetails:\n- Service: ${service.name}\n- Date: ${date}\n- Time: ${time}\n- Guests: ${guests}\n\nA confirmation email will be sent to ${email}.`,
      bookingId: result.insertedId
    };
  } catch (error) {
    console.error('Error booking service:', error);
    return {
      success: false,
      message: "Sorry, there was an error processing your service booking. Please try again."
    };
  }
}

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

// Function to extract booking details from natural language
async function extractBookingDetails(message) {
  try {
    const bookingPrompt = PromptTemplate.fromTemplate(`
Extract booking details from the following message. If any required information is missing, return null for that field.
Do not make assumptions about missing data.

Message: {message}

Required fields:
1. Full Name
2. Email
3. Check-in date (YYYY-MM-DD)
4. Check-out date (YYYY-MM-DD)
5. Room Type
6. Number of Guests

Return the data in exactly this format (including the brackets):
[name]|[email]|[checkIn]|[checkOut]|[roomType]|[guests]

Example valid outputs:
John Doe|john@email.com|2024-04-01|2024-04-03|Deluxe Ocean View|2
null|null|2024-05-01|2024-05-03|Ocean View|null
`);

    const chain = bookingPrompt.pipe(llm).pipe(new StringOutputParser());
    const result = await chain.invoke({ message });
    
    if (!result || !result.includes('|')) {
      return null;
    }

    const [name, email, checkIn, checkOut, roomType, guests] = result.split('|');
    
    // Return null if any required field is missing or "null"
    if ([name, email, checkIn, checkOut, roomType, guests].includes('null')) {
      return null;
    }

    return [name, email, checkIn, checkOut, roomType, guests];
  } catch (error) {
    console.error('Error extracting booking details:', error);
    return null;
  }
}

// Function to identify missing booking information
function identifyMissingInfo(bookingDetails) {
  const fields = ['name', 'email', 'check-in date', 'check-out date', 'room type', 'number of guests'];
  const missing = [];
  
  if (!bookingDetails) {
    return fields;
  }

  bookingDetails.forEach((detail, index) => {
    if (!detail || detail === 'null') {
      missing.push(fields[index]);
    }
  });
  
  return missing;
}

// Enhanced prompt template for the main conversation
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

Instructions:
1. If the message seems to be about booking a room:
   - If all required information is present, respond with "BOOKING:" followed by the details in this format:
     BOOKING: [name], [email], [check-in], [check-out], [room-type], [guests]
   - If information is missing, ask for the specific missing details politely
   - Suggest available room types if the requested type isn't specified or available

2. If the message is about services:
   - Guide users to available services and their details
   - Ask for specific preferences and requirements

3. For general inquiries:
   - Provide detailed but concise information
   - Mention any relevant special offers
   - Be helpful and professional

Remember to be courteous while maintaining a friendly tone.
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
  console.log('\n=== New Webhook Request ===');
  try {
    const text = await req.text();
    const formData = new URLSearchParams(text);
    let message = formData.get('Body');
    const from = formData.get('From');
    const numMedia = parseInt(formData.get('NumMedia') || '0');
    
    // Handle voice message
    if (formData.get('MediaContentType0')?.startsWith('audio/')) {
      console.log('🎤 Voice message detected');
      const audioUrl = formData.get('MediaUrl0');
      try {
        message = await transcribeVoiceMessage(audioUrl);
        console.log('\n✅ Successfully transcribed voice message:');
        console.log('From:', from);
        console.log('Transcript:', message);
      } catch (error) {
        console.error('❌ Voice transcription error:', error);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message("I'm sorry, I couldn't understand the voice message. Could you please try again or send your request as text?");
        return new NextResponse(twiml.toString(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        });
      }
    } else {
      console.log('💬 Text message received');
    }

    if (!message) {
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("I couldn't understand your message. Could you please try again?");
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    console.log('Processing message:', message);
    console.log('From:', from);

    // Get real-time hotel data
    const hotelData = await getHotelData();

    // Generate initial response using Groq LLM
    const chain = hotelPrompt.pipe(llm).pipe(new StringOutputParser());
    const llmResponse = await chain.invoke({ 
      message,
      roomTypes: hotelData.roomTypes,
      serviceList: hotelData.serviceList,
      specialOffers: hotelData.specialOffers
    });
    console.log('LLM Response:', llmResponse);

    // Check if the response indicates a booking attempt
    if (llmResponse.includes('BOOKING:')) {
      const bookingStr = llmResponse.split('BOOKING:')[1].trim();
      const bookingDetails = await extractBookingDetails(message);
      
      if (bookingDetails) {
        const bookingResult = await handleBooking(bookingDetails);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(bookingResult.message);
        return new NextResponse(twiml.toString(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        });
      } else {
        // Handle missing information
        const missingFields = identifyMissingInfo(bookingDetails);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(`I'd be happy to help you with your booking. Could you please provide the following information:\n- ${missingFields.join('\n- ')}`);
        return new NextResponse(twiml.toString(), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' }
        });
      }
    }

    // Handle regular conversation
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(llmResponse);

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message('Sorry, there was an error processing your request. Please try again.');
    
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
} 