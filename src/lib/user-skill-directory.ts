export interface DirectoryFileLike {
  name: string
  webkitRelativePath?: string
}

export function userSkillDirectoryRelativePaths(files: readonly DirectoryFileLike[]): string[] {
  const paths = files.map((file) => {
    const relative = (file.webkitRelativePath || file.name).replaceAll('\\', '/').replace(/^\/+/, '')
    return relative.split('/').filter(Boolean)
  })
  if (paths.length === 0) return []
  const selectedRoot = paths[0]?.length > 1 ? paths[0][0] : ''
  const hasSharedSelectedRoot = Boolean(selectedRoot) && paths.every((parts) => parts.length > 1 && parts[0] === selectedRoot)
  return paths.map((parts) => (hasSharedSelectedRoot ? parts.slice(1) : parts).join('/'))
}
