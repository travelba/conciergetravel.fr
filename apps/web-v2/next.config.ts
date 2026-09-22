import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@mch/ui-v2'],
  },
  transpilePackages: ['@mch/ui-v2', '@mch/seo', '@mch/domain', '@mch/db', '@mch/integrations'],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async redirects() {
    return [
      {
        source: '/le-concierge-club',
        destination: '/programme-membre',
        permanent: true,
      },
      {
        source: '/le-concierge-club/:path*',
        destination: '/programme-membre',
        permanent: true,
      },
      {
        source: '/en/the-concierge-club',
        destination: '/en/member-program',
        permanent: true,
      },
      {
        source: '/en/the-concierge-club/:path*',
        destination: '/en/member-program',
        permanent: true,
      },
      {
        source: '/presse/le-concierge-club',
        destination: '/presse/programme-membre',
        permanent: true,
      },
      {
        source: '/le-concierge/fidelite',
        destination: '/programme-membre',
        permanent: true,
      },
      {
        source: '/en/le-concierge/loyalty',
        destination: '/en/member-program',
        permanent: true,
      },
      {
        source: '/compte/rejoindre',
        destination: '/compte/inscription',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
