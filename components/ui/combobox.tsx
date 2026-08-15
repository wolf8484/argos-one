'use client'

import * as React from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowAdd?: boolean
  onAdd?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  allowAdd = false,
  onAdd,
  disabled = false,
  invalid = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const q = query.trim()
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
  const hasExact = options.some((o) => o.toLowerCase() === q.toLowerCase())
  const showAdd = allowAdd && q.length > 0 && !hasExact

  function select(v: string) {
    onValueChange(v)
    setOpen(false)
    setQuery('')
  }

  function add() {
    onAdd?.(q)
    select(q)
  }

  function openMenu() {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) select(filtered[0])
      else if (showAdd) add()
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        data-invalid={invalid || undefined}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-card px-3.5 text-left text-body-md text-foreground transition-colors outline-none',
          'focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10',
          'disabled:pointer-events-none disabled:opacity-50',
          invalid ? 'border-destructive' : 'border-[var(--hairline)]'
        )}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-[var(--hairline)] bg-popover shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <div className="border-b border-[var(--hairline)] p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md bg-transparent px-2 text-body-md text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => select(o)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-body-md text-foreground hover:bg-muted"
                >
                  <span className="truncate">{o}</span>
                  {value.toLowerCase() === o.toLowerCase() && <Check size={15} className="shrink-0" />}
                </button>
              </li>
            ))}
            {showAdd && (
              <li>
                <button
                  type="button"
                  onClick={add}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-body-md text-foreground hover:bg-muted"
                >
                  <Plus size={15} className="shrink-0" /> Add &ldquo;{q}&rdquo;
                </button>
              </li>
            )}
            {filtered.length === 0 && !showAdd && (
              <li className="px-3 py-2.5 text-body-sm text-muted-foreground">{emptyText}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
