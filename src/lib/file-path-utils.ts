const FILE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
  'md', 'mdx',
  'txt', 'log', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'env',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'rs', 'go', 'java', 'kt', 'c', 'cpp', 'h', 'hpp',
  'cs', 'swift', 'rb', 'php', 'lua', 'sh', 'bash',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml',
  'sql', 'graphql', 'vue', 'svelte',
  'dockerfile', 'makefile', 'proto',
  'tf', 'hcl', 'zig', 'dart', 'hs', 'elm',
])

export function isLikelyFilePath(text: string): boolean {
  if (!text.includes('/')) return false
  if (text.startsWith('http')) return false
  if (text.includes(' ')) return false
  const dot = text.lastIndexOf('.')
  if (dot === -1) return false
  return FILE_EXTS.has(text.slice(dot + 1).toLowerCase())
}
