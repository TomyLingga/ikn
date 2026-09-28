/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image Docker produksi memakai output standalone (ikn-fe/Dockerfile).
  output: 'standalone',
  images: {
    unoptimized: true,
    // Media dari ikn-api (dev: http://localhost:8000/storage/..., produksi: https).
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Tidak ada rewrite ke API: browser memanggil NEXT_PUBLIC_API_URL langsung (Sanctum cookie SPA, CORS + credentials),
  // server component memakai API_INTERNAL_URL. Lihat plan/01-architecture.md bagian 2.
};

export default nextConfig;
