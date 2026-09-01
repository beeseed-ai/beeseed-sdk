import { describe, expect, it } from 'vitest'
import { userSkillDirectoryRelativePaths } from './user-skill-directory.js'

describe('userSkillDirectoryRelativePaths', () => {
  it('removes only the browser selected directory prefix', () => {
    expect(userSkillDirectoryRelativePaths([
      { name: 'SKILL.md', webkitRelativePath: 'demo/SKILL.md' },
      { name: 'guide.md', webkitRelativePath: 'demo/references/guide.md' },
    ])).toEqual(['SKILL.md', 'references/guide.md'])
  })

  it('does not guess away a meaningful nested directory', () => {
    expect(userSkillDirectoryRelativePaths([
      { name: 'SKILL.md', webkitRelativePath: 'references/SKILL.md' },
    ])).toEqual(['SKILL.md'])
    expect(userSkillDirectoryRelativePaths([
      { name: 'SKILL.md' },
      { name: 'guide.md' },
    ])).toEqual(['SKILL.md', 'guide.md'])
  })
})
