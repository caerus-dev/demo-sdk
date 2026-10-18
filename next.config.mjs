const nextConfig = {
  compress: false,
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.io',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@grpc/grpc-js', '@caerus-dev/sdk'],
}

export default nextConfig
