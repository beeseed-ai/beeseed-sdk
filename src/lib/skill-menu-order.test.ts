import { describe, expect, it } from 'vitest'
import { normalizeSkillMenuOrder, orderSkillMenuItems } from './skill-menu-order.js'

describe('skill menu order', () => {
  it('normalizes blank and duplicate skill ids while preserving first occurrence', () => {
    expect(normalizeSkillMenuOrder([' ppt-master ', '', 'ppt-master', null, 'pdf'])).toEqual(['ppt-master', 'pdf'])
  })

  it('keeps configured skills first and appends new skills by Chinese display name', () => {
    const items = [
      { name: 'news', display_name: '每日新闻' },
      { name: 'paper', display_name: '医学论文写作助手' },
      { name: 'ppt-master', display_name: 'PPT Master' },
      { name: 'search', display_name: '火山引擎事实核查搜索' },
    ]

    expect(orderSkillMenuItems(items, ['paper', 'ppt-master', 'missing']).map((item) => item.name)).toEqual([
      'paper',
      'ppt-master',
      'search',
      'news',
    ])
  })
})
