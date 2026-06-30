'use client'

export function Field({
  label, value, onChange, type = 'text',
  required = false, half = false, placeholder = ''
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  half?: boolean
  placeholder?: string
}) {
  return (
    <div className={half ? 'col-span-1' : 'col-span-2'}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

export function TextArea({
  label, value, onChange, rows = 3
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-1">
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      <p className="text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  )
}

export function SaveBar({
  saving, saved, onCancel
}: {
  saving: boolean
  saved: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        Cancel
      </button>
      {saved && <span className="text-green-600 text-sm">Saved successfully</span>}
    </div>
  )
}
