/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add a rule to handle binary files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
      type: 'javascript/auto',
    });

    // Exclude sharp from client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        sharp: false,
      };
    }

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp', '@xenova/transformers'],
  },
};

export default nextConfig;
