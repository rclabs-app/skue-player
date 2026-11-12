/**
 * useTvRemote
 *
 * Normalizes remote-control keycodes from all major Smart TV platforms:
 *   - Android TV / Fire TV        (standard + vendor keycodes)
 *   - Samsung Tizen (Orsay + Tizen)
 *   - LG webOS
 *   - HbbTV / CI+ compliant remotes
 *   - Philips / Sony
 *   - Generic keyboard (development)
 *
 * Usage:
 *   const { onRemoteKey } = useTvRemote()
 *   onRemoteKey('OK',    () => doSelect())
 *   onRemoteKey('BACK',  () => goBack())
 *   onRemoteKey('UP',    () => moveFocusUp())
 */

import { onMounted, onUnmounted } from 'vue'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export type RemoteKey =
  | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'OK' | 'BACK' | 'HOME'
  | 'PLAY' | 'PAUSE' | 'PLAY_PAUSE'
  | 'STOP' | 'REWIND' | 'FAST_FORWARD'
  | 'PREV_CHANNEL' | 'NEXT_CHANNEL'
  | 'RED' | 'GREEN' | 'YELLOW' | 'BLUE'
  | 'NUM_0' | 'NUM_1' | 'NUM_2' | 'NUM_3' | 'NUM_4'
  | 'NUM_5' | 'NUM_6' | 'NUM_7' | 'NUM_8' | 'NUM_9'
  | 'CHANNEL_UP' | 'CHANNEL_DOWN'
  | 'VOLUME_UP' | 'VOLUME_DOWN' | 'MUTE'
  | 'INFO' | 'MENU' | 'EXIT'
  | 'PAGE_UP' | 'PAGE_DOWN'

// ─── Platform keyCode maps ────────────────────────────────────────────────────
const KEY_MAP: Record<string, RemoteKey> = {
  // Standard arrow keys (all platforms + keyboard)
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',

  // OK / Select / Enter
  Enter: 'OK',

  // Back / Escape
  Escape: 'BACK',
  Backspace: 'BACK',
  XF86Back: 'BACK',

  // Page navigation (mapped to channel up/down for category scrolling)
  PageUp: 'PAGE_UP',
  PageDown: 'PAGE_DOWN',

  // Media keys (standard KeyboardEvent.key values)
  MediaPlayPause: 'PLAY_PAUSE',
  MediaPlay: 'PLAY',
  MediaPause: 'PAUSE',
  MediaStop: 'STOP',
  MediaRewind: 'REWIND',
  MediaFastForward: 'FAST_FORWARD',
  MediaTrackPrevious: 'PREV_CHANNEL',
  MediaTrackNext: 'NEXT_CHANNEL',

  // Volume
  AudioVolumeUp: 'VOLUME_UP',
  AudioVolumeDown: 'VOLUME_DOWN',
  AudioVolumeMute: 'MUTE',

  // Info
  Info: 'INFO',

  // Number keys
  '0': 'NUM_0', '1': 'NUM_1', '2': 'NUM_2', '3': 'NUM_3', '4': 'NUM_4',
  '5': 'NUM_5', '6': 'NUM_6', '7': 'NUM_7', '8': 'NUM_8', '9': 'NUM_9',
}

// Samsung Tizen / older Orsay numeric keyCode map
const KEYCODE_MAP: Record<number, RemoteKey> = {
  // Standard
  38: 'UP', 40: 'DOWN', 37: 'LEFT', 39: 'RIGHT',
  13: 'OK',
  27: 'BACK', 8: 'BACK',

  // Samsung Tizen
  10009: 'BACK',
  10182: 'EXIT',
  10232: 'INFO',
  10133: 'HOME',
  10135: 'PLAY_PAUSE',
  10252: 'PLAY_PAUSE',
  415:   'PLAY',
  19:    'PAUSE',
  413:   'STOP',
  412:   'REWIND',
  417:   'FAST_FORWARD',
  427:   'CHANNEL_UP',
  428:   'CHANNEL_DOWN',
  403:   'RED',
  404:   'GREEN',
  405:   'YELLOW',
  406:   'BLUE',
  33:    'PAGE_UP',
  34:    'PAGE_DOWN',

  // LG webOS
  461: 'BACK',
  36:  'HOME',

  // Number pad (keyCode 48-57 = '0'-'9')
  48: 'NUM_0', 49: 'NUM_1', 50: 'NUM_2', 51: 'NUM_3', 52: 'NUM_4',
  53: 'NUM_5', 54: 'NUM_6', 55: 'NUM_7', 56: 'NUM_8', 57: 'NUM_9',
  // Numpad
  96: 'NUM_0', 97: 'NUM_1', 98: 'NUM_2', 99: 'NUM_3', 100: 'NUM_4',
  101: 'NUM_5', 102: 'NUM_6', 103: 'NUM_7', 104: 'NUM_8', 105: 'NUM_9',

  // Volume
  447: 'VOLUME_UP', 448: 'VOLUME_DOWN', 449: 'MUTE',

  // Android TV MediaKeyEvent codes (as seen via WebView)
  179: 'PLAY_PAUSE',  // KEYCODE_MEDIA_PLAY_PAUSE
  85:  'PLAY_PAUSE',
  126: 'PLAY',
  127: 'PAUSE',
  86:  'STOP',
  89:  'REWIND',
  90:  'FAST_FORWARD',
}

type Handler = (e: KeyboardEvent) => void | boolean

interface Registration {
  key: RemoteKey
  handler: Handler
  /** If true, this handler stops propagation and prevents default */
  exclusive?: boolean
}

// Global registry — allows multiple composable instances to coexist
const _registry: Registration[] = []

let _installed = false

function _dispatch(e: KeyboardEvent) {
  // Normalize to a RemoteKey
  const remoteKey = KEY_MAP[e.key] ?? KEYCODE_MAP[e.keyCode] ?? null
  if (!remoteKey) return

  // Walk handlers in reverse registration order (last registered = highest priority)
  for (let i = _registry.length - 1; i >= 0; i--) {
    const reg = _registry[i]
    if (reg.key !== remoteKey) continue

    const result = reg.handler(e)
    if (result !== false) {
      // Default: prevent browser default (e.g. page scroll on arrows)
      e.preventDefault()
      return
    }
  }
}

function _registerTizenKeys() {
  try {
    const tizenObj = typeof window !== 'undefined' ? (window as any).tizen : null
    if (tizenObj?.tvinputdevice?.registerKey) {
      const keys = [
        'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop',
        'MediaFastForward', 'MediaRewind',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'
      ]
      for (const k of keys) {
        try {
          tizenObj.tvinputdevice.registerKey(k)
        } catch {}
      }
    }
  } catch {}
}

function _install() {
  if (_installed) return
  _installed = true
  _registerTizenKeys()
  window.addEventListener('keydown', _dispatch, { capture: true })
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', () => {
      _dispatch(new KeyboardEvent('keydown', { key: 'Escape' }) as any)
    })
  }
}

function _uninstall() {
  if (_registry.length > 0) return // still has consumers
  _installed = false
  window.removeEventListener('keydown', _dispatch, { capture: true })
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function useTvRemote() {
  const localRegs: Registration[] = []

  /**
   * Register a handler for a remote key.
   * Returns an unsubscribe function.
   */
  function onRemoteKey(key: RemoteKey, handler: Handler, exclusive = false) {
    const reg: Registration = { key, handler, exclusive }
    _registry.push(reg)
    localRegs.push(reg)
    return () => off(reg)
  }

  function off(reg: Registration) {
    const i = _registry.indexOf(reg)
    if (i !== -1) _registry.splice(i, 1)
  }

  onMounted(_install)

  onUnmounted(() => {
    for (const reg of localRegs) {
      const i = _registry.indexOf(reg)
      if (i !== -1) _registry.splice(i, 1)
    }
    localRegs.length = 0
    _uninstall()
  })

  return { onRemoteKey }
}
