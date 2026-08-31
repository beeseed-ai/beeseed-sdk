import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ChatArtifact } from '../../core/types.js'
import { EditableArtifactActions } from './MessageBubble.js'

interface ElementWithChildren {
  children?: ReactNode
}

interface ButtonProps {
  'aria-label'?: string
  onClick?: () => void
  type?: string
}

const artifact: ChatArtifact = {
  artifactId: 'artifact-1',
  storageRef: 'storage://workspace/artifacts/demo.pptx',
  fileName: 'demo.pptx',
  artifactKind: 'pptx',
  version: 2,
  editable: true,
}

function artifactButtons(onPreview = vi.fn(), onRevise = vi.fn()) {
  const element = EditableArtifactActions({ artifacts: [artifact], onPreview, onRevise })
  const card = Children.toArray(element.props.children)[0]
  expect(isValidElement(card)).toBe(true)

  const children = Children.toArray((card as ReactElement<ElementWithChildren>).props.children)
  return {
    onPreview,
    onRevise,
    previewButton: children[0] as ReactElement<ButtonProps>,
    reviseButton: children[1] as ReactElement<ButtonProps>,
  }
}

describe('EditableArtifactActions', () => {
  it('renders the artifact file area as an accessible preview button', () => {
    const html = renderToStaticMarkup(
      <EditableArtifactActions artifacts={[artifact]} onPreview={vi.fn()} onRevise={vi.fn()} />,
    )

    expect(html).toContain('<button type="button" aria-label="预览文件：demo.pptx"')
    expect(html).toContain('demo.pptx')
    expect(html).toContain('演示文稿 · v2')
  })

  it('previews the exact artifact storage reference without changing revise behavior', () => {
    const { onPreview, onRevise, previewButton, reviseButton } = artifactButtons()

    expect(previewButton.type).toBe('button')
    expect(previewButton.props.type).toBe('button')
    expect(previewButton.props['aria-label']).toBe('预览文件：demo.pptx')
    previewButton.props.onClick?.()
    expect(onPreview).toHaveBeenCalledOnce()
    expect(onPreview).toHaveBeenCalledWith(artifact)
    expect(onRevise).not.toHaveBeenCalled()

    reviseButton.props.onClick?.()
    expect(onRevise).toHaveBeenCalledOnce()
    expect(onRevise).toHaveBeenCalledWith(artifact)
  })
})
