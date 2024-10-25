/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true, // This will allow any image source
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
