# Hotel WhatsApp Chatbot

A Next.js-based WhatsApp chatbot for hotel reservations with Stripe payment integration.

## Features

- WhatsApp integration using Twilio
- Hotel reservation management
- Stripe payment processing
- MongoDB Atlas database integration
- LangChain for natural language processing

## Prerequisites

- Node.js 16+ and npm
- MongoDB Atlas account
- Twilio account with WhatsApp integration
- OpenAI API key
- Stripe account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd project-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example` and fill in your credentials:
```bash
cp .env.example .env
```

4. Configure your environment variables in the `.env` file:
- Set up MongoDB Atlas and add your connection string
- Add your Twilio credentials
- Configure your Stripe API keys
- Add your OpenAI API key

5. Run the development server:
```bash
npm run dev
```

## Webhook Setup

1. Deploy your application or use a tunnel service like ngrok for local development
2. Set up your Twilio WhatsApp webhook URL to point to:
   `https://your-domain/api/webhook`

## Usage

The chatbot supports the following commands:
- "Book" or "reservation" - Start the booking process
- Booking format: "Book: [name], [email], [check-in], [check-out], [room-type], [guests]"
  Example: "Book: John Doe, john@example.com, 2024-04-01, 2024-04-03, double, 2"

## Room Types and Pricing

- Single Room: $100/night
- Double Room: $200/night
- Suite: $300/night

## Development

The project structure:
- `/src/app/api/webhook` - WhatsApp webhook handler
- `/src/models` - MongoDB schemas
- `/src/lib` - Utility functions

## Security

- All sensitive information is stored in environment variables
- Stripe handles payment information securely
- MongoDB Atlas provides database security

## License

MIT
