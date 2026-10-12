/** @type {import('next').NextConfig} */
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

const nextConfig = (phase) => ({
  // Keep dev compilation separate from production builds.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
})

module.exports = nextConfig
