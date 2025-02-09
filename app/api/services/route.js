import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

// GET all services with filtering
export async function GET(request) {
  try {
    const { db } = await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const maxPrice = searchParams.get('maxPrice');

    // Build query
    let query = {};
    if (type) query.type = type;
    if (isActive !== null) query.isActive = isActive === 'true';
    if (maxPrice) query.price = { $lte: parseInt(maxPrice) };

    console.log('Executing MongoDB query:', query);

    // Use MongoDB collection directly
    const services = await db.collection('services').find(query).toArray();
    console.log('Found services:', services);

    if (!services || services.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST create new service
export async function POST(request) {
  try {
    const { db } = await connectDB();
    
    const body = await request.json();

    // Add timestamps and default values
    const serviceData = {
      ...body,
      isActive: body.isActive ?? true,
      ratings: {
        average: 0,
        count: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('services').insertOne(serviceData);
    const newService = await db.collection('services').findOne({ _id: result.insertedId });
    
    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
} 