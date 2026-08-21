export interface EPGProgram {
  id: string
  channelId: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  category?: string
}
