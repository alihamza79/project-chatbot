import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import { Service } from '../../../models';

// GET all services with filtering
export async function GET(request) {
  try {
    await connectDB();
    
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

    const services = await Service.find(query);
    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST create new service
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const service = await Service.create(body);
    
    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 