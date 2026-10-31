/**
 * 全站手写图解数据：中英双语只写一份，组件按当前语言渲染。
 * All hand-drawn diagrams, bilingual, single source.
 * 组件会自动适配明暗主题与移动端。
 */

import { c00 } from './d00'
import { c01 } from './d01'
import { c02 } from './d02'
import { c03 } from './d03'
import { c04 } from './d04'
import { c05 } from './d05'
import { c06 } from './d06'
import { c07 } from './d07'
import { c08 } from './d08'
import { c09 } from './d09'
import { c10 } from './d10'
import { c11 } from './d11'
import { c12 } from './d12'
import { c13 } from './d13'
import { c14 } from './d14'
import { c15 } from './d15'
import { c16 } from './d16'

export type Tone = 'accent' | 'coral' | 'blue' | 'lime' | 'muted'

export interface FlowNode {
  t: string
  s?: string
  tone?: Tone
}

export type DiagramSpec =
  | {
      kind: 'flow'
      caption: { zh: string; en: string }
      zh: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
      en: { nodes: FlowNode[]; edges?: string[]; dir?: 'h' | 'v' }
    }
  | {
      kind: 'layers'
      caption: { zh: string; en: string }
      zh: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
      en: { layers: { t: string; items: string[]; tone?: Tone; note?: string }[] }
    }
  | {
      kind: 'sequence'
      caption: { zh: string; en: string }
      zh: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
      en: { actors: string[]; steps: { from: number; to: number; t: string; dashed?: boolean }[] }
    }
  | {
      kind: 'lifecycle'
      caption: { zh: string; en: string }
      zh: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
      en: { states: { t: string; s: string; tone?: Tone }[]; note?: string }
    }
  | {
      kind: 'compare'
      caption: { zh: string; en: string }
      zh: {
        left: { title: string; sub: string; points: string[] }
        right: { title: string; sub: string; points: string[] }
        axis?: string
      }
      en: {
        left: { title: string; sub: string; points: string[] }
        right: { title: string; sub: string; points: string[] }
        axis?: string
      }
    }
  | {
      kind: 'hub'
      caption: { zh: string; en: string }
      zh: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
      en: { center: string; nodes: string[]; mode?: 'star' | 'broadcast' | 'cycle'; note?: string }
    }
  | {
      kind: 'matrix'
      caption: { zh: string; en: string }
      zh: { head: string[]; rows: string[][]; highlight?: number[] }
      en: { head: string[]; rows: string[][]; highlight?: number[] }
    }

export const diagrams: Record<string, DiagramSpec> = {
  ...c00,
  ...c01,
  ...c02,
  ...c03,
  ...c04,
  ...c05,
  ...c06,
  ...c07,
  ...c08,
  ...c09,
  ...c10,
  ...c11,
  ...c12,
  ...c13,
  ...c14,
  ...c15,
  ...c16,
}
