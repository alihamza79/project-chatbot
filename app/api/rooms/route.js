import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import { Room } from '../../../models';

// GET all rooms or filter by query parameters
export async function GET(request) {
  try {
    await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const maxPrice = searchParams.get('maxPrice');
    const minPrice = searchParams.get('minPrice');

    // Build query
    let query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (maxPrice || minPrice) {
      query.pricePerNight = {};
      if (maxPrice) query.pricePerNight.$lte = parseInt(maxPrice);
      if (minPrice) query.pricePerNight.$gte = parseInt(minPrice);
    }

    const rooms = await Room.find(query);
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST create new room
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const room = await Room.create(body);
    
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 