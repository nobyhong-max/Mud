import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [],
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default withNextIntl(nextConfig);
