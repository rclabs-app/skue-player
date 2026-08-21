import { db } from '../lib/database'
import type { EPGProgram } from '../types/epg'
import EpgWorker from '../workers/epg-parser.worker?worker'

import { getApiUrl } from '../utils/api'

export type { EPGProgram }

export class EPGService {
  static isSyncing = false

  static async getCurrentProgram(channelId: string, channelName: string, _channelGroup = '', epgId?: string): Promise<EPGProgram | null> {
    try {
      let program = null

      // 1. Try matching by EPG ID (tvg-id) if available
      if (epgId) {
        program = await db.getCurrentEpgProgram(epgId)
      }

      // 2. Fallback to matching by channel name
      if (!program && channelName) {
        program = await db.getCurrentEpgProgram(channelName)
      }

      // 3. Fallback to channel ID (in case they match)
      if (!program && channelId) {
        program = await db.getCurrentEpgProgram(channelId)
      }

      if (program) {
        return program
      }
    } catch (e) {
      console.error('Failed to get current program from DB:', e)
    }

    return null
  }

  static async syncEPG(epgUrl: string, onProgress?: (status: string) => void): Promise<void> {
    if (this.isSyncing) return
    this.isSyncing = true
    try {
      if (onProgress) onProgress('Baixando EPG...')
      const token = await db.getConfig('device_token')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(getApiUrl('/api/v1/proxy'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: epgUrl })
      })

      if (!response.ok) {
        throw new Error(`Erro ao baixar EPG: ${response.statusText}`)
      }

      if (onProgress) onProgress('Lendo EPG...')
      const xmlText = await response.text()

      if (onProgress) onProgress('Processando programas...')
      const programs = await new Promise<EPGProgram[]>((resolve, reject) => {
        const worker = new EpgWorker()
        
        worker.onmessage = (e) => {
          if (e.data.error) {
            reject(new Error(e.data.error))
          } else {
            resolve(e.data.programs)
          }
          worker.terminate()
        }
        
        worker.onerror = (err) => {
          reject(err)
          worker.terminate()
        }
        
        worker.postMessage({ xmlText })
      })

      if (onProgress) onProgress(`Limpando EPG antigo...`)
      await db.clearEpg()

      if (onProgress) onProgress(`Salvando ${programs.length} programas no banco local...`)
      await db.saveEpgPrograms(programs)
      
      if (onProgress) onProgress('EPG atualizado com sucesso!')
    } catch (e: any) {
      console.error('EPG sync error:', e)
      if (onProgress) onProgress(`Falha ao sincronizar EPG: ${e.message}`)
      throw e
    } finally {
      this.isSyncing = false
    }
  }
}
