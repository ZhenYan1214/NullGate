/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Semaphore uses snarkjs which has dynamic requires; silence the warning.
    config.externals = config.externals || [];
    config.externals.push({ "utf-8-validate": "commonjs utf-8-validate", bufferutil: "commonjs bufferutil" });
    return config;
  },
};
module.exports = nextConfig;
