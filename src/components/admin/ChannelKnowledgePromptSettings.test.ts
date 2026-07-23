import { describe, expect, it } from 'vitest'
import { uniqueChannelTemplateOptions } from './ChannelKnowledgePromptSettings.js'

describe('uniqueChannelTemplateOptions', () => {
  it('shows each channel template exactly once instead of listing user channel instances', () => {
    const result = uniqueChannelTemplateOptions([
      { id: 'research', name: '耳医学研究' },
      { id: 'cases', name: '案例整理' },
      { id: 'research', name: '耳医学研究' },
      { id: '', name: '无效模板' },
      { name: '缺少模板 ID' },
    ])

    expect(result.map((item) => item.id)).toEqual(['research', 'cases'])
  })
})
