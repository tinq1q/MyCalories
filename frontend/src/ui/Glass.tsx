import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

type GlassProps<T extends ElementType> = {
  as?: T
  className?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

// A frosted-glass surface; styling lives in theme.css (.glass).
export default function Glass<T extends ElementType = 'div'>({ as, className, children, ...rest }: GlassProps<T>) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag className={className ? `glass ${className}` : 'glass'} {...rest}>
      {children}
    </Tag>
  )
}
