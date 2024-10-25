/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/solana-labs/token-list/main/assets/**',
      },
      {
        protocol: 'https',
        hostname: 'arweave.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.arweave.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        port: '',
        pathname: '/**',
      },
      // Add HubSpot domain
      {
        protocol: 'https',
        hostname: '424565.fs1.hubspotusercontent-na1.net',
        port: '',
        pathname: '/hubfs/**',
      },
      // Add a catch-all for other token images
      {
        protocol: 'https',
        hostname: '*.hubspotusercontent-na1.net',
        port: '',
        pathname: '/**',
      }
    ],
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
