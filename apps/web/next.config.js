/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@crm/ui"],
  output: "standalone"
};

module.exports = nextConfig;
