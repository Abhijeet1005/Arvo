/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundles only what's needed to run into .next/standalone, so deploying to
  // the Pi doesn't require shipping the full node_modules tree.
  output: 'standalone',
};
module.exports = nextConfig;
