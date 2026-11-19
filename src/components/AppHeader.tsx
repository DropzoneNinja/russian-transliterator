import type { ReactNode } from 'react'

interface AppHeaderProps {
  children?: ReactNode
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-(--color-border) bg-(--color-surface) px-3 py-2 sm:px-4">
      <h1 className="text-base font-semibold text-(--color-text) sm:text-lg">
        Russian Transliterator
      </h1>
      {children}
    </header>
  )
}
