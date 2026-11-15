import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// The asset pack lives at the project root (./models, ./textures, ./hdri, ./fonts).
// In dev Vite serves those folders straight from the root; for production builds
// this plugin copies them next to the bundle so `vite preview` works the same way.
const ASSET_DIRS = ['models', 'textures', 'hdri', 'fonts'];
const copyAssetPack = (): Plugin => ({
  name: 'copy-asset-pack',
  apply: 'build',
  closeBundle() {
    for (const d of ASSET_DIRS) fs.cpSync(path.resolve(d), path.resolve('dist', d), { recursive: true });
    fs.copyFileSync('assets-manifest.json', 'dist/assets-manifest.json');
  },
});

export default defineConfig({
  base: './',
  publicDir: false,
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  server: { host: true },
  plugins: [copyAssetPack()],
});
