import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/contact',
  '/faq',
  '/how-it-works',
  '/login',
  '/needs(.*)',
  '/privacy',
  '/register',
  '/support',
  '/terms',
  '/transparency',
  '/api(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (isPublicRoute(req)) return NextResponse.next();

  if (!userId) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|.*\.(?:png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|woff2|ttf|map)$).*)'],
};
