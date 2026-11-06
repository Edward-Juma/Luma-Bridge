import { NextResponse } from 'next/server';

export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\.(?:png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|woff2|ttf|map)$).*)'],
};
