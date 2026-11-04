/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve modern formats; next/image negotiates AVIF then WebP per request.
    formats: ['image/avif', 'image/webp'],
  },
  // Mobile v2 funnel: static page in public/free-inspection, served at clean URLs.
  // /free-inspection/thank-you is a real URL so ad platforms can track it as a conversion.
  async rewrites() {
    return [
      { source: '/free-inspection', destination: '/free-inspection/index.html' },
      { source: '/free-inspection/thank-you', destination: '/free-inspection/index.html' },
    ];
  },
};

module.exports = nextConfig;
