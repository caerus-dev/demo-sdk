const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@grpc/grpc-js', '@caerus-dev/sdk'],
}

export default nextConfig
