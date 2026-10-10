const frameAncestors = process.env.PORTFOLIO_ORIGIN
  ? `'self' ${process.env.PORTFOLIO_ORIGIN}`
  : "'self' https:";

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

export default nextConfig;
