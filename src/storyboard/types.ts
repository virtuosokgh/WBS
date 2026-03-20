export type BadgeSize = 'S' | 'M' | 'L' | 'XL'

export const BADGE_SIZE_PX: Record<BadgeSize, { diameter: number; fontSize: number }> = {
  S:  { diameter: 22, fontSize: 10 },
  M:  { diameter: 28, fontSize: 11 },
  L:  { diameter: 36, fontSize: 13 },
  XL: { diameter: 46, fontSize: 14 },
}

export const BADGE_SIZE_LABELS: BadgeSize[] = ['S', 'M', 'L', 'XL']

export interface Badge {
  id: string
  label: string       // 배지에 표시되는 텍스트/숫자
  x: number           // 이미지 기준 비율 (0~1)
  y: number
  description: string
  size: BadgeSize     // 뱃지 크기
}

export interface FigmaFrame {
  id: string
  name: string
  imageUrl: string    // Figma export image URL
  figmaUrl: string    // 원본 Figma 링크
  width: number
  height: number
  pageId?: string
  pageName?: string
}

export interface Screen {
  id: string
  frame: FigmaFrame
  badges: Badge[]
}

export interface SavedProject {
  id: string
  name: string
  savedAt: number   // Date.now() timestamp
  screens: Screen[]
}
