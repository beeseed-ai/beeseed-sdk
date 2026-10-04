import { describe, expect, it } from 'vitest'
import { storageDirectoryDisplayName, storageRefDisplayText, storageRefsFromText } from './storage-ref.js'

describe('storageRefsFromText', () => {
  it('excludes Markdown code delimiters from a storage reference', () => {
    expect(storageRefsFromText('文件引用：`storage://目录/报告.md`')).toEqual([
      'storage://%E7%9B%AE%E5%BD%95/%E6%8A%A5%E5%91%8A.md',
    ])
  })

  it('recognizes a workspace artifact path inside bold inline code', () => {
    expect(storageRefsFromText('文件位置：**`/workspace/artifacts/演示文稿.pptx`**')).toEqual([
      'storage://workspace/artifacts/%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF.pptx',
    ])
  })

  it('does not include Chinese parentheses and explanatory text in a file key', () => {
    expect(storageRefsFromText('对应 PDF：storage://document.pdf（两个文件均保持原样，不会修改）。PPT（storage://deck.pptx）')).toEqual([
      'storage://document.pdf', 'storage://deck.pptx',
    ])
  })

  it('preserves encoded parentheses belonging to a file name', () => {
    expect(storageRefsFromText('storage://report%EF%BC%88final%EF%BC%89.pdf')).toEqual([
      'storage://report%EF%BC%88final%EF%BC%89.pdf',
    ])
  })

  it('keeps the readable directory while hiding a generated object UUID from the visible path', () => {
    expect(storageRefDisplayText('storage://%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB/da7d0da1-ebdd-4475-ad27-5a18efc03a40-%E6%AF%8F%E6%97%A5%E6%96%B0%E9%97%BB_20260928.md'))
      .toBe('storage://每日新闻/每日新闻_20260928.md')
  })

  it('does not change ordinary business paths that have no generated UUID prefix', () => {
    expect(storageRefDisplayText('storage://notes/task.md')).toBe('storage://notes/task.md')
  })

  it('uses understandable names for internal storage directories without changing the reference', () => {
    const ref = 'storage://cloudflare-runtime/509c21e0-0e2c-4be9-a503-e7822f6145d6/09e56528-b2c2-5a52-b93f-42c62247492e/任天堂Switch2红蓝配色.pptx'
    expect(storageRefDisplayText(ref)).toBe('storage://AI 生成文件/任天堂Switch2红蓝配色.pptx')
    expect(storageDirectoryDisplayName('cloudflare-runtime/')).toBe('AI 生成文件')
    expect(storageDirectoryDisplayName('reasonix-runtime/')).toBe('历史 AI 生成文件')
    expect(storageDirectoryDisplayName('__chat_uploads/')).toBe('聊天附件')
  })
})
