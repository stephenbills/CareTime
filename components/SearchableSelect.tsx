'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface Option {
  value: string
  label: string
  searchText?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  emptyText?: string
}

export default function SearchableSelect({
  value, onChange, options, placeholder = '— Select —', emptyText = 'No options',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find(o => o.value === value)
  const filtered = query
    ? options.filter(o => (o.searchText || o.label).toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-300">{emptyText}</p>
            ) : (
              filtered.map(o => (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                    o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  }`}>
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
