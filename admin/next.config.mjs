import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Turbopack: фиксируем root каталог admin (иначе при нескольких lockfile возможны сломанные чанки / пустой UI). */
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
