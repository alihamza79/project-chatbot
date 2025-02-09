import { NextResponse } from 'next/server';
import { connectDB } from '../../../lib/mongodb';

export const dynamic = 'force-dynamic';

// GET all reviews with filtering
export async function GET(request) {
  try {
    const { db } = await connectDB();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const minRating = searchParams.get('minRating');
    const isVerified = searchParams.get('isVerified');
    const guestEmail = searchParams.get('email');

    // Build query
    let query = {};
    if (minRating) query.rating = { $gte: parseInt(minRating) };
    if (isVerified !== null) query.isVerified = isVerified === 'true';
    if (guestEmail) query['guest.email'] = guestEmail;

    console.log('Executing MongoDB query:', query);

    // Use MongoDB aggregation to get reviews with reservation and room details
    const reviews = await db.collection('reviews').aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'reservations',
          localField: 'reservation',
          foreignField: '_id',
          as: 'reservation'
        }
      },
      {
        $unwind: '$reservation'
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'reservation.room',
          foreignField: '_id',
          as: 'room'
        }
      },
      {
        $unwind: '$room'
      }
    ]).toArray();

    console.log('Found reviews:', reviews);

    if (!reviews || reviews.length === 0) {
      return NextResponse.json([]);
    }

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

// POST create new review
export async function POST(request) {
  try {
    const { db } = await connectDB();
    
    const body = await request.json();

    // Verify reservation exists
    const reservation = await db.collection('reservations').findOne({ 
      _id: body.reservation,
      'guest.email': body.guest.email 
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or does not belong to this guest' },
        { status: 404 }
      );
    }

    // Check if review already exists
    const existingReview = await db.collection('reviews').findOne({ 
      reservation: body.reservation 
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this reservation' },
        { status: 400 }
      );
    }

    // Add timestamps and initial verification status
    const reviewData = {
      ...body,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('reviews').insertOne(reviewData);
    const newReview = await db.collection('reviews').findOne({ _id: result.insertedId });
    
    return NextResponse.json(newReview, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
} 