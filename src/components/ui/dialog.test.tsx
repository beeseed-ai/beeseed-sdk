// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { Dialog, DialogContent } from './dialog.js'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let host: HTMLDivElement
afterEach(async () => { if (root) await act(() => root.unmount()); host?.remove() })

it('关闭按钮不提交表单，点击内容不关闭，遮罩与 Escape 可关闭', async () => {
  const close = vi.fn()
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(() => root.render(<form onSubmit={submit}><Dialog open onOpenChange={close}>
    <DialogContent onClose={() => close(false)}><span>内容</span></DialogContent>
  </Dialog></form>))
  const content = host.querySelector<HTMLElement>('[role="dialog"]')!
  expect(content.className).toContain('max-h-[calc(100dvh-2rem)]')
  expect(content.className).toContain('overflow-y-auto')
  await act(() => content.click())
  expect(close).not.toHaveBeenCalled()
  await act(() => host.querySelector<HTMLButtonElement>('button')!.click())
  expect(close).toHaveBeenLastCalledWith(false)
  expect(submit).not.toHaveBeenCalled()
  close.mockClear()
  await act(() => host.querySelector<HTMLElement>('[aria-hidden="true"]')!.click())
  expect(close).toHaveBeenCalledTimes(1)
  close.mockClear()
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(close).toHaveBeenCalledTimes(1)
})

it('Escape 只关闭最上层弹窗', async () => {
  const outer = vi.fn(), inner = vi.fn()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(() => root.render(<><Dialog open onOpenChange={outer}><DialogContent>外层</DialogContent></Dialog>
    <Dialog open onOpenChange={inner}><DialogContent>内层</DialogContent></Dialog></>))
  await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(outer).not.toHaveBeenCalled()
  expect(inner).toHaveBeenCalledWith(false)
})
