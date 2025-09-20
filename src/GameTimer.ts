// Global game timer

export class GameTimer {
  private static startTime: number | null = null
  private static endTime: number | null = null

  static start() {
    this.startTime = Date.now()
    this.endTime = null
  }

  static stop() {
    if (this.startTime) {
      this.endTime = Date.now()
    }
  }

  static getTime(): string {
    if (!this.startTime) return '0s'
    const endTime = this.endTime || Date.now()
    return this.formatTime(endTime - this.startTime)
  }

  static formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    } else {
      return `${seconds}s`
    }
  }
}
