import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * 표 호버 컨트롤 - contentEditable 에디터 내 표에 마우스 올리면
 * 행/열 추가(+) 삭제(−) 버튼이 표 가장자리에 나타남
 *
 * Props:
 *   editorRef - contentEditable 요소의 ref
 *   onContentChange - 표가 변경될 때 호출 (에디터 콘텐츠 동기화용)
 */
export default function TableHoverControls({ editorRef, onContentChange }) {
  const [state, setState] = useState(null)
  const hideTimer = useRef(null)

  function clearHideTimer() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }

  function scheduleHide() {
    clearHideTimer()
    hideTimer.current = setTimeout(() => setState(null), 120)
  }

  const handleMouseMove = useCallback((e) => {
    clearHideTimer()
    const el = editorRef.current
    if (!el) return

    const cell = e.target.closest('td, th')
    if (!cell || !el.contains(cell)) { scheduleHide(); return }

    const table = cell.closest('table')
    if (!table) { scheduleHide(); return }

    const tr = cell.closest('tr')
    const allRows = Array.from(table.querySelectorAll('tr'))
    const rowIndex = allRows.indexOf(tr)
    const colIndex = Array.from(tr.children).indexOf(cell)

    setState({
      table,
      tableRect: table.getBoundingClientRect(),
      rowRect: tr.getBoundingClientRect(),
      colRect: cell.getBoundingClientRect(),
      rowIndex,
      colIndex,
      totalRows: allRows.length,
      totalCols: tr.children.length,
    })
  }, [editorRef])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const onLeave = () => scheduleHide()
    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseleave', onLeave)
    // 스크롤 시 위치 갱신을 위해 숨김
    const scrollParent = el.closest('.overflow-y-auto') || el.parentElement
    const onScroll = () => setState(null)
    scrollParent?.addEventListener('scroll', onScroll)
    return () => {
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseleave', onLeave)
      scrollParent?.removeEventListener('scroll', onScroll)
      clearHideTimer()
    }
  }, [editorRef, handleMouseMove])

  /* ── 표 조작 ── */
  function addRow() {
    if (!state) return
    const { table } = state
    const lastRow = table.querySelector('tbody tr:last-child') || table.querySelector('tr:last-child')
    if (!lastRow) return
    const colCount = lastRow.children.length
    const newRow = document.createElement('tr')
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td')
      td.innerHTML = '<br>'
      newRow.appendChild(td)
    }
    lastRow.after(newRow)
    onContentChange?.()
    // 상태 갱신
    setState(prev => prev ? { ...prev, tableRect: state.table.getBoundingClientRect(), totalRows: prev.totalRows + 1 } : null)
  }

  function addCol() {
    if (!state) return
    const { table } = state
    table.querySelectorAll('tr').forEach(row => {
      const lastCell = row.children[row.children.length - 1]
      if (!lastCell) return
      const isHeader = lastCell.tagName === 'TH'
      const newCell = document.createElement(isHeader ? 'th' : 'td')
      newCell.innerHTML = isHeader ? '제목' : '<br>'
      lastCell.after(newCell)
    })
    onContentChange?.()
    setState(prev => prev ? { ...prev, tableRect: state.table.getBoundingClientRect(), totalCols: prev.totalCols + 1 } : null)
  }

  function removeRow() {
    if (!state || state.totalRows <= 1) return
    const { table, rowIndex } = state
    const rows = table.querySelectorAll('tr')
    if (rows[rowIndex]) rows[rowIndex].remove()
    setState(null)
    onContentChange?.()
  }

  function removeCol() {
    if (!state || state.totalCols <= 1) return
    const { table, colIndex } = state
    table.querySelectorAll('tr').forEach(row => {
      const cells = Array.from(row.children)
      if (cells[colIndex]) cells[colIndex].remove()
    })
    setState(null)
    onContentChange?.()
  }

  if (!state) return null

  const { tableRect, rowRect, colRect, totalRows, totalCols } = state

  return createPortal(
    <div
      onMouseEnter={clearHideTimer}
      onMouseLeave={() => setState(null)}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
    >
      {/* 행 추가 (+) - 표 아래 중앙 */}
      <button
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addRow() }}
        title="행 추가"
        style={{
          ...addBtnStyle,
          pointerEvents: 'auto',
          left: tableRect.left + tableRect.width / 2 - 11,
          top: tableRect.bottom + 2,
        }}
      >+</button>

      {/* 열 추가 (+) - 표 오른쪽 중앙 */}
      <button
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addCol() }}
        title="열 추가"
        style={{
          ...addBtnStyle,
          pointerEvents: 'auto',
          left: tableRect.right + 2,
          top: tableRect.top + tableRect.height / 2 - 11,
        }}
      >+</button>

      {/* 행 삭제 (−) - 호버된 행 왼쪽 */}
      {totalRows > 1 && (
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeRow() }}
          title="행 삭제"
          style={{
            ...delBtnStyle,
            pointerEvents: 'auto',
            left: tableRect.left - 22,
            top: rowRect.top + rowRect.height / 2 - 9,
          }}
        >−</button>
      )}

      {/* 열 삭제 (−) - 호버된 열 상단 */}
      {totalCols > 1 && (
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeCol() }}
          title="열 삭제"
          style={{
            ...delBtnStyle,
            pointerEvents: 'auto',
            left: colRect.left + colRect.width / 2 - 9,
            top: tableRect.top - 22,
          }}
        >−</button>
      )}
    </div>,
    document.body
  )
}

const addBtnStyle = {
  position: 'fixed',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#6366f1',
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  lineHeight: '20px',
  textAlign: 'center',
  border: '2px solid #fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'transform 0.1s, background 0.1s',
}

const delBtnStyle = {
  position: 'fixed',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#ef4444',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '16px',
  textAlign: 'center',
  border: '2px solid #fff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  opacity: 0.85,
  transition: 'transform 0.1s, opacity 0.1s',
}
