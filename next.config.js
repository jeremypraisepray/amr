/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Serve modern formats; next/image negotiates AVIF then WebP per request.
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
