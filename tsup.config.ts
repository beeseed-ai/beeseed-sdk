import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    hooks: 'src/hooks/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  external: ['react', 'react-dom'],
  treeshake: true,
  splitting: true,
  sourcemap: true,
  clean: true,
})
