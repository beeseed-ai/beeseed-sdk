import { describe, expect, it } from 'vitest'
import { buildChannelTemplateSkillMenu } from './channelSkillMenu.js'

describe('channel template skill menu', () => {
  it('deduplicates skills across agents and keeps all executable agents', () => {
    const items = buildChannelTemplateSkillMenu(
      ['writer', 'researcher'],
      ['shared', 'writer-only'],
      [
        { id: 'writer', name: '写作助手', skills: ['writer-only', 'shared'] },
        { id: 'researcher', name: '科研助手', skills: ['shared', 'new-skill'] },
      ],
      [
        { name: 'shared', display_name: '共享技能' },
        { name: 'writer-only', display_name: '写作技能' },
        { name: 'new-skill', display_name: '新增技能' },
      ],
    )

    expect(items.map((item) => item.name)).toEqual(['shared', 'writer-only', 'new-skill'])
    expect(items[0].agents.map((agent) => agent.id)).toEqual(['writer', 'researcher'])
  })

  it('filters unavailable configured skills and appends newly available skills', () => {
    const items = buildChannelTemplateSkillMenu(
      ['researcher'],
      ['removed-skill', 'existing'],
      [{ id: 'researcher', name: '科研助手', skills: ['new-skill', 'existing'] }],
      [
        { name: 'existing', display_name: '已有技能' },
        { name: 'new-skill', display_name: '新增技能' },
      ],
    )

    expect(items.map((item) => item.name)).toEqual(['existing', 'new-skill'])
  })
})
