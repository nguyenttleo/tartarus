/** @type {import('next').NextConfig} */

// Allow the portfolio (and any https origin, by default) to embed this app in its live-preview
// iframe. Set PORTFOLIO_ORIGIN to lock embedding to your portfolio's exact domain.
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
          // NB: deliberately NOT X-Frame-Options: DENY — that would block the portfolio preview.
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

export default nextConfig;
