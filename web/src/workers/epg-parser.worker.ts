import type { EPGProgram } from '../types/epg'

function parseXmltvDate(str: string): Date {
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s+([+-]\d{4}))?/)
  if (!match) return new Date(str)
  const [, year, month, day, hour, minute, second, tz] = match
  const isoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  if (tz) {
    const tzFormatted = tz.substring(0, 3) + ':' + tz.substring(3)
    return new Date(isoStr + tzFormatted)
  }
  return new Date(isoStr + 'Z')
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

self.onmessage = (e: MessageEvent) => {
  const { xmlText } = e.data

  if (!xmlText) {
    self.postMessage({ error: 'No XML content provided' })
    return
  }

  try {
    const programs: EPGProgram[] = []
    const programmeRegex = /<programme([^>]*)>([\s\S]*?)<\/programme>/g
    
    let match
    let idCounter = 0
    
    while ((match = programmeRegex.exec(xmlText)) !== null) {
      const [, attrs, innerContent] = match
      
      const startMatch = attrs.match(/start="([^"]+)"/i)
      const stopMatch = attrs.match(/stop="([^"]+)"/i)
      const channelMatch = attrs.match(/channel="([^"]+)"/i)
      
      if (!startMatch || !stopMatch || !channelMatch) continue
      
      const startStr = startMatch[1]
      const stopStr = stopMatch[1]
      const channelId = channelMatch[1]

      const titleMatch = innerContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      if (!titleMatch) continue
      const title = decodeXmlEntities(titleMatch[1].trim())
      
      const descMatch = innerContent.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i)
      const description = descMatch ? decodeXmlEntities(descMatch[1].trim()) : ''
      
      const startTime = parseXmltvDate(startStr)
      const endTime = parseXmltvDate(stopStr)
      
      const id = `${channelId}_${startTime.getTime()}_${idCounter++}`
      
      programs.push({
        id,
        channelId,
        title,
        description,
        startTime,
        endTime
      })
    }

    self.postMessage({ programs })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unknown error during EPG parsing' })
  }
}
