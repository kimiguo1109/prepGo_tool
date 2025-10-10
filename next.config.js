/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyBIuZ9MUHmj6sCxGa4Cbvvb2Zzw5AfU-BA',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 忽略 pdf-parse 的 canvas 依赖
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'canvas',
      });
    }

    // 修复 pdfjs-dist 在客户端的问题
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    
    return config;
  },
  // 将 pdf-parse 设置为外部包，避免 webpack 打包时的问题
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;
