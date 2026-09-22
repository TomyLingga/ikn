/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Backend Laravel dinonaktifkan: berjalan standalone dengan database Supabase & Mock Store.
  async rewrites() {
    if (process.env.USE_BACKEND === 'true' && process.env.API_ORIGIN) {
      return [
        { source: '/api/:path*', destination: `${process.env.API_ORIGIN}/api/:path*` },
        { source: '/sanctum/:path*', destination: `${process.env.API_ORIGIN}/sanctum/:path*` },
        { source: '/storage/:path*', destination: `${process.env.API_ORIGIN}/storage/:path*` },
      ];
    }
    return [];
  },
};

export default nextConfig;
