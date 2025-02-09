import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { ChatGroq } from '@langchain/groq';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

export const dynamic = 'force-dynamic'; // This is important for webhook endpoints
export const runtime = 'nodejs';

// Initialize Groq with Llama model
const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  maxTokens: 1024,
});

// Create prompt template for hotel assistant
const hotelPrompt = PromptTemplate.fromTemplate(`
You are a friendly and professional hotel assistant. The guest has sent the following message:
{message}

Available services and information:
- Room Types: Single ($100/night), Double ($200/night), Suite ($300/night)
- Booking format: Book: [name], [email], [check-in], [check-out], [room-type], [guests]
- Room availability check
- Room amenities and features
- Payment assistance
- General hotel information

Respond naturally and helpfully. Keep responses concise but informative.
If they ask about booking, guide them to use the booking format.
If they ask about rooms, include pricing information.
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
    // Get the raw body as text
    const text = await req.text();
    console.log('Raw request body:', text);

    // Parse the URL-encoded form data
    const formData = new URLSearchParams(text);
    const message = formData.get('Body');
    const from = formData.get('From');

    console.log('Processing message:', message);
    console.log('From:', from);

    // Generate response using Groq LLM
    const chain = hotelPrompt.pipe(llm).pipe(new StringOutputParser());
    const llmResponse = await chain.invoke({ message });
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