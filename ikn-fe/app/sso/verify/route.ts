import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ success: true, verified: false }, { status: 200 });
}

export function POST() {
  return NextResponse.json({ success: true, verified: false }, { status: 200 });
}
