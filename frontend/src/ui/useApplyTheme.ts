import { useLayoutEffect } from 'react'
import type { ThemeId } from '../domain/types'

// Themes are pure CSS: theme.css switches every colour variable on
// <html data-theme="…">, so applying one is just setting the attribute.
export function useApplyTheme(theme: ThemeId): void {
  // Layout effect: the attribute is in place before the first paint.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
}
