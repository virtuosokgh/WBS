/**
 * Figma URL 파싱 유틸
 *
 * 지원 형식:
 *   https://www.figma.com/file/{fileKey}/...?node-id={nodeId}
 *   https://www.figma.com/design/{fileKey}/...?node-id={nodeId}
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string | null } | null {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/')
    // /file/{key}/... or /design/{key}/...
    const typeIdx = parts.findIndex(p => p === 'file' || p === 'design')
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null
    const fileKey = parts[typeIdx + 1]
    const rawNodeId = u.searchParams.get('node-id')
    // node-id는 "1234-5678" 형태 → API는 "1234:5678" 형태 필요
    // "0:1" 또는 "0:0"은 루트/캔버스 노드 → 파일 전체 로드로 처리
    const converted = rawNodeId ? rawNodeId.replace(/-(\d)/g, ':$1') : null
    const nodeId = converted && converted !== '0:1' && converted !== '0:0' ? converted : null
    return { fileKey, nodeId }
  } catch {
    return null
  }
}

/**
 * Figma REST API 직접 호출 (CORS 지원, 별도 서버 불필요)
 */
async function figmaFetch(path: string, token: string) {
  const res = await fetch(`https://api.figma.com${path}`, {
    headers: { 'X-Figma-Token': token }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `Figma API error: ${res.status}`)
  }
  return res.json()
}

export interface FigmaNodeMeta {
  id: string
  name: string
  width: number
  height: number
}

/**
 * 파일의 특정 노드(or 루트) 정보 가져오기
 */
export async function fetchFigmaNodeMeta(
  fileKey: string,
  nodeId: string | null,
  token: string
): Promise<FigmaNodeMeta[]> {
  if (nodeId) {
    const data = await figmaFetch(`/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`, token)
    const node = data.nodes?.[nodeId]?.document
    if (!node) throw new Error('노드를 찾을 수 없습니다.')
    const bbox = node.absoluteBoundingBox || node.size || { width: 0, height: 0 }
    return [{ id: node.id, name: node.name, width: bbox.width, height: bbox.height }]
  } else {
    // 모든 페이지의 프레임 수집 (Section/Group 내부까지, depth=3)
    const data = await figmaFetch(`/v1/files/${fileKey}?depth=3`, token)
    const frames: FigmaNodeMeta[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectFrames = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'FRAME' || node.type === 'COMPONENT') {
          const bbox = node.absoluteBoundingBox || node.size || { width: 0, height: 0 }
          frames.push({ id: node.id, name: node.name, width: bbox.width, height: bbox.height })
        } else if (node.type === 'SECTION' || node.type === 'GROUP') {
          // 섹션/그룹 안에 있는 프레임도 수집
          collectFrames(node.children ?? [])
        }
      }
    }

    for (const page of (data.document?.children ?? [])) {
      collectFrames(page.children ?? [])
    }

    return frames.slice(0, 100)
  }
}

/**
 * 노드 이미지 URL 가져오기 (PNG export)
 */
export async function fetchFigmaImageUrl(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<string> {
  const data = await figmaFetch(
    `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`,
    token
  )
  const url = data.images?.[nodeId]
  if (!url) throw new Error('이미지를 내보낼 수 없습니다.')
  return url
}

/**
 * 여러 노드 이미지 URL 한 번에 가져오기 (배치 export)
 */
export async function fetchFigmaImageUrls(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {}
  const data = await figmaFetch(
    `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(','))}&format=png&scale=2`,
    token
  )
  return data.images ?? {}
}
