/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "tesseract.js"],
    outputFileTracingIncludes: {
      "/api/knowledge/upload": ["./node_modules/@tesseract.js-data/**/*.gz"],
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
