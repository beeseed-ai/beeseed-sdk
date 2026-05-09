import { useState, createContext, useContext, type ReactNode } from 'react'
import { cn } from '../../lib/cn.js'

const TabsContext = createContext<{ value: string; onChange: (v: string) => void }>({ value: '', onChange: () => {} })

interface TabsProps { defaultValue: string; children: ReactNode; className?: string }
export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [value, setValue] = useState(defaultValue)
  return <TabsContext.Provider value={{ value, onChange: setValue }}><div className={className}>{children}</div></TabsContext.Provider>
}

interface TabsListProps { children: ReactNode; className?: string }
export function TabsList({ children, className }: TabsListProps) {
  return <div className={cn('inline-flex items-center gap-1 rounded-lg bg-muted p-1', className)}>{children}</div>
}

interface TabsTriggerProps { value: string; children: ReactNode; className?: string }
export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >{children}</button>
  )
}

interface TabsContentProps { value: string; children: ReactNode; className?: string }
export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
