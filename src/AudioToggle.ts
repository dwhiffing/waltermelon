export const MUSIC_VOLUME = 0.4
export class AudioToggle {
  static audioState: number = 0 // 0=all, 1=no-music, 2=muted
  private static musicKeys = ['music', 'music-loop']

  static toggle(scene: Phaser.Scene) {
    this.audioState = (this.audioState + 1) % 3

    this.applyState(scene)
    this.saveState()
  }

  static applyState(scene: Phaser.Scene) {
    switch (this.audioState) {
      case 0:
        scene.sound.volume = 1
        this.setMusicVolume(scene, 1)
        break
      case 1:
        this.setMusicVolume(scene, 0)
        break
      case 2:
        scene.sound.volume = 0
        break
    }
  }

  private static setMusicVolume(scene: Phaser.Scene, volume: number) {
    this.musicKeys.forEach((key) => {
      const sound = scene.sound.get(key)
      ;(sound as any)?.setVolume(volume === 1 ? MUSIC_VOLUME : 0)
    })
  }

  private static saveState() {
    try {
      localStorage.setItem('audioState', this.audioState.toString())
    } catch (e) {}
  }

  static loadState(scene: Phaser.Scene) {
    try {
      const saved = localStorage.getItem('audioState')
      const parsed = parseInt(saved || '0', 10)
      if (parsed >= 0 && parsed <= 2) {
        this.audioState = parsed
      }
    } catch (e) {}
    this.applyState(scene)
  }
}
