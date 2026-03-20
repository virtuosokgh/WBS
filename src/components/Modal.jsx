import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = '확인',
  confirmVariant = 'primary',
  confirmDisabled = false,
  size = 'md',
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  const confirmClass = confirmVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClass} flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {(onConfirm || onClose) && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${confirmClass}`}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
