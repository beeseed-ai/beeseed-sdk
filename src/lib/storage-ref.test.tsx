import { describe, expect, it } from 'vitest'
import { storageRefsFromText } from './storage-ref.js'

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
})
