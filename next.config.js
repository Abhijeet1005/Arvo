/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundles only what's needed to run into .next/standalone, so deploying to
  // the Pi doesn't require shipping the full node_modules tree.
  output: 'standalone',
  // The autopilot's mail libraries load Node built-ins at runtime; leave them
  // as plain requires instead of bundling them (standalone still copies them).
  serverExternalPackages: ['imapflow', 'mailparser', 'nodemailer'],
};
module.exports = nextConfig;
