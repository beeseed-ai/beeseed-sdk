import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ChannelManageTab.tsx', import.meta.url), 'utf8')

describe('ChannelManageTab retired runtime controls', () => {
  it('does not expose ReasonIX memory or publication controls after runtime retirement', () => {
    expect(source).not.toContain('频道 ReasonIX 内存')
    expect(source).not.toContain('reasonix_memory_limit_mb')
    expect(source).not.toContain('runtime-snapshots')
    expect(source).not.toContain("api.get('admin/channels')")
  })
})
