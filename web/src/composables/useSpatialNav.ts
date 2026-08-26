/**
 * useSpatialNav
 *
 * Spatial (D-pad) navigation engine for Smart TV.
 */

import { ref, type Ref } from 'vue'
import { useTvRemote, type RemoteKey } from './useTvRemote'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[data-tv-focusable]',
].join(', ')

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

interface Zone {
  id: string
  containerRef: Ref<HTMLElement | null>
  defaultFocusSelector?: string
  /** Explicit zone transition rules: direction → zone id */
  rules: Partial<Record<Direction, string>>
}

interface Rect { x: number; y: number; w: number; h: number; cx: number; cy: number }

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
}

function getFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el => !el.closest('[data-tv-ignore]') && el.offsetParent !== null
  )
}

function score(from: Rect, to: Rect, dir: Direction): number | null {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  const EPSILON = 8
  switch (dir) {
    case 'RIGHT': if (to.x < from.x + from.w - EPSILON) return null; break
    case 'LEFT':  if (to.x + to.w > from.x + EPSILON) return null; break
    case 'DOWN':  if (to.y < from.y + from.h - EPSILON) return null; break
    case 'UP':    if (to.y + to.h > from.y + EPSILON) return null; break
  }
  const primary   = (dir === 'LEFT' || dir === 'RIGHT') ? Math.abs(dx) : Math.abs(dy)
  const secondary = (dir === 'LEFT' || dir === 'RIGHT') ? Math.abs(dy) : Math.abs(dx)
  return primary + secondary * 2.5
}

export function useSpatialNav() {
  const zonesMap = new Map<string, Zone>()
  const activeZoneId = ref<string | null>(null)
  const { onRemoteKey } = useTvRemote()

  function registerZone(id: string, containerRef: Ref<HTMLElement | null>, opts?: { defaultFocusSelector?: string }) {
    zonesMap.set(id, { id, containerRef, defaultFocusSelector: opts?.defaultFocusSelector, rules: {} })
  }

  function setZoneRule(zoneId: string, dir: Direction, targetZoneId: string) {
    const zone = zonesMap.get(zoneId)
    if (zone) zone.rules[dir] = targetZoneId
  }

  function focusZone(id: string, preferLast = false) {
    const zone = zonesMap.get(id)
    const container = zone?.containerRef.value
    if (!container) return false

    const els = getFocusables(container)
    if (!els.length) return false

    const selector = zone!.defaultFocusSelector
    const target = selector
      ? (container.querySelector<HTMLElement>(selector) ?? els[preferLast ? els.length - 1 : 0])
      : els[preferLast ? els.length - 1 : 0]

    target.focus({ preventScroll: false })
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    activeZoneId.value = id
    return true
  }

  function currentZone(): Zone | null {
    const focused = document.activeElement as HTMLElement | null
    if (!focused) return null
    for (const [, zone] of zonesMap) {
      if (zone.containerRef.value?.contains(focused)) {
        activeZoneId.value = zone.id
        return zone
      }
    }
    return null
  }

  function navigate(dir: Direction) {
    const focused = document.activeElement as HTMLElement | null
    const zone = currentZone()

    if (!focused || !zone) {
      const first = zonesMap.values().next().value as Zone | undefined
      if (first) focusZone(first.id)
      return
    }

    const fromRect = getRect(focused)

    // 1. Spatial search within current zone
    const container = zone.containerRef.value
    if (container) {
      const candidates = getFocusables(container).filter(el => el !== focused)
      let best: HTMLElement | null = null
      let bestScore = Infinity
      for (const el of candidates) {
        const s = score(fromRect, getRect(el), dir)
        if (s !== null && s < bestScore) { bestScore = s; best = el }
      }
      if (best) {
        best.focus({ preventScroll: false })
        best.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return
      }
    }

    // 2. Explicit zone rule
    const targetZoneId = zone.rules[dir]
    if (targetZoneId) {
      focusZone(targetZoneId, dir === 'LEFT' || dir === 'UP')
      return
    }

    // 3. Cross-zone spatial search
    let bestGlobal: HTMLElement | null = null
    let bestGlobalScore = Infinity
    for (const [zid, z] of zonesMap) {
      if (zid === zone.id) continue
      const c = z.containerRef.value
      if (!c) continue
      for (const el of getFocusables(c)) {
        const s = score(fromRect, getRect(el), dir)
        if (s !== null && s < bestGlobalScore) { bestGlobalScore = s; bestGlobal = el }
      }
    }
    if (bestGlobal) {
      bestGlobal.focus({ preventScroll: false })
      bestGlobal.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      for (const [zid, z] of zonesMap) {
        if (z.containerRef.value?.contains(bestGlobal)) { activeZoneId.value = zid; break }
      }
    }
  }

  function activate() {
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
    for (const dir of dirs) {
      onRemoteKey(dir as RemoteKey, () => {
        const ae = document.activeElement
        if (ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA') return false
        navigate(dir)
      })
    }
  }

  return { registerZone, setZoneRule, focusZone, currentZone, navigate, activate, activeZoneId }
}

export type SpatialNav = ReturnType<typeof useSpatialNav>
