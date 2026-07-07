/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 다중 인스턴스(중앙/엣지 동시 구동) 시 빌드 디렉터리 분리용. 기본 .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
