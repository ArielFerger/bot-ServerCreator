import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Empaqueta solo lo que hace falta para correr: la imagen pasa de ~1 GB a ~200 MB.
  // En Vercel no: su compilador produce su propio formato y `standalone` estorba.
  output: process.env.VERCEL ? undefined : "standalone",
  // En un monorepo hay que decirle dónde está la raíz para que copie los workspaces.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Los paquetes del monorepo se publican como TypeScript sin compilar.
  transpilePackages: ["@aribuilder/core", "@aribuilder/applier"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
};

export default config;
