import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// GET all reservations with filtering
export async function GET(request) {
  try {
    const { db } = await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const guestEmail = searchParams.get('email');

    // Build query
    let query = {};
    if (status) query.status = status;
    if (guestEmail) query['guest.email'] = guestEmail;
    if (from || to) {
      query.checkIn = {};
      if (from) query.checkIn.$gte = new Date(from);
      if (to) query.checkIn.$lte = new Date(to);
    }

    console.log('Executing MongoDB query:', query);

    // Use MongoDB aggregation to get reservations with room and service details
    const reservations = await db.collection('reservations').aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'rooms',
          localField: 'room',
          foreignField: '_id',
          as: 'room'
        }
      },
      { $unwind: '$room' },
      {
        $lookup: {
          from: 'services',
          localField: 'addOns.service',
          foreignField: '_id',
          as: 'services'
        }
      }
    ]).toArray();

    console.log('Found reservations:', reservations);

    if (!reservations || reservations.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST create new reservation
export async function POST(request) {
  try {
    const { db } = await connectDB();
    
    const body = await request.json();

    // Check if room exists and is available
    const room = await db.collection('rooms').findOne({ 
      _id: new ObjectId(body.room),
      status: 'Available'
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found or is not available' },
        { status: 404 }
      );
    }

    // Check for overlapping reservations
    const overlappingReservation = await db.collection('reservations').findOne({
      room: new ObjectId(body.room),
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkIn: { 
            $lte: new Date(body.checkOut),
            $gte: new Date(body.checkIn)
          }
        },
        {
          checkOut: {
            $gte: new Date(body.checkIn),
            $lte: new Date(body.checkOut)
          }
        }
      ]
    });

    if (overlappingReservation) {
      return NextResponse.json(
        { error: 'Room is already booked for these dates' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const nights = Math.ceil(
      (new Date(body.checkOut) - new Date(body.checkIn)) / (1000 * 60 * 60 * 24)
    );
    
    // Add timestamps and initial status
    const reservationData = {
      ...body,
      room: new ObjectId(body.room),
      totalAmount: room.pricePerNight * nights,
      status: 'confirmed',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Convert service IDs to ObjectId if addOns are present
    if (reservationData.addOns) {
      reservationData.addOns = reservationData.addOns.map(addon => ({
        ...addon,
        service: new ObjectId(addon.service)
      }));
    }

    const result = await db.collection('reservations').insertOne(reservationData);
    
    // Update room status
    await db.collection('rooms').updateOne(
      { _id: new ObjectId(body.room) },
      { $set: { status: 'reserved' } }
    );

    // Get the complete reservation with populated data
    const newReservation = await db.collection('reservations').aggregate([
      { $match: { _id: result.insertedId } },
      {
        $lookup: {
          from: 'rooms',
          localField: 'room',
          foreignField: '_id',
          as: 'room'
        }
      },
      { $unwind: '$room' },
      {
        $lookup: {
          from: 'services',
          localField: 'addOns.service',
          foreignField: '_id',
          as: 'services'
        }
      }
    ]).next();
    
    return NextResponse.json(newReservation, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
} 