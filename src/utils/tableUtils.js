// 표 행/열 추가·삭제 유틸리티 (contentEditable 에디터용)

/** 현재 커서 위치의 테이블 컨텍스트 반환 */
export function getTableContext(editorEl) {
  const sel = window.getSelection()
  if (!sel.rangeCount) return null
  const node = sel.anchorNode
  const cell = node?.nodeType === 3
    ? node.parentElement?.closest('td,th')
    : node?.closest?.('td,th')
  if (!cell || !editorEl?.contains(cell)) return null
  const row = cell.closest('tr')
  const table = cell.closest('table')
  if (!row || !table) return null
  const colIndex = Array.from(row.cells).indexOf(cell)
  return { cell, row, table, colIndex }
}

/** 현재 행 아래에 새 행 추가 */
export function addTableRow(editorEl) {
  const ctx = getTableContext(editorEl)
  if (!ctx) return false
  const newRow = document.createElement('tr')
  Array.from(ctx.row.cells).forEach(() => {
    const td = document.createElement('td')
    td.innerHTML = '<br>'
    newRow.appendChild(td)
  })
  ctx.row.after(newRow)
  // 새 행 첫 셀에 커서 이동
  const firstCell = newRow.cells[0]
  if (firstCell) {
    const range = document.createRange()
    range.setStart(firstCell, 0)
    range.collapse(true)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }
  return true
}

/** 현재 열 오른쪽에 새 열 추가 */
export function addTableCol(editorEl) {
  const ctx = getTableContext(editorEl)
  if (!ctx) return false
  ctx.table.querySelectorAll('tr').forEach(tr => {
    const refCell = tr.cells[ctx.colIndex]
    if (refCell) {
      const tag = refCell.tagName.toLowerCase() === 'th' ? 'th' : 'td'
      const newCell = document.createElement(tag)
      newCell.innerHTML = tag === 'th' ? '제목' : '<br>'
      refCell.after(newCell)
    }
  })
  return true
}

/** 현재 행 삭제 (최소 1행 유지) */
export function removeTableRow(editorEl) {
  const ctx = getTableContext(editorEl)
  if (!ctx) return false
  if (ctx.table.querySelectorAll('tr').length <= 1) return false
  ctx.row.remove()
  return true
}

/** 현재 열 삭제 (최소 1열 유지) */
export function removeTableCol(editorEl) {
  const ctx = getTableContext(editorEl)
  if (!ctx) return false
  if (ctx.row.cells.length <= 1) return false
  ctx.table.querySelectorAll('tr').forEach(tr => {
    if (tr.cells[ctx.colIndex]) tr.cells[ctx.colIndex].remove()
  })
  return true
}
