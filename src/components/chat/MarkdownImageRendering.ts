import { createContext, type ReactNode } from 'react'

export interface MarkdownImageContext {
  messageId?: number
  messageTimestamp?: number
  senderId?: string
}

export interface MarkdownImageRenderProps {
  src?: string
  alt?: string
  title?: string
  context?: MarkdownImageContext
  defaultImage: ReactNode
}

export type MarkdownImageRenderer = (props: MarkdownImageRenderProps) => ReactNode | undefined

export const markdownImageRendererContext = createContext<MarkdownImageRenderer | undefined>(undefined)
export const markdownImageContext = createContext<MarkdownImageContext | undefined>(undefined)
