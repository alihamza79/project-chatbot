import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

// GET all rooms or filter by query parameters
export async function GET(request) {
  try {
    const { db } = await connectDB();
    
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

    console.log('Executing MongoDB query:', query);

    // Use the MongoDB collection directly
    const rooms = await db.collection('rooms').find(query).toArray();
    console.log('Found rooms:', rooms);

    if (!rooms || rooms.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST create new room
export async function POST(request) {
  try {
    const { db } = await connectDB();
    
    const body = await request.json();
    
    // Add timestamps
    const roomData = {
      ...body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('rooms').insertOne(roomData);
    const newRoom = await db.collection('rooms').findOne({ _id: result.insertedId });
    
    return NextResponse.json(newRoom, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
} 