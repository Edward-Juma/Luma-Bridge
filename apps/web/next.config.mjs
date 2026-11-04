/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true }, // seed art is SVG; Cloudinary URLs are already optimised
  // The browser only ever talks to the web origin; Next proxies to the API so the refresh cookie is
  // first-party and CORS/CSRF stay simple. Add your CDN host here when you move uploads to Cloudinary.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/files/:path*', destination: `${API_URL}/files/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
