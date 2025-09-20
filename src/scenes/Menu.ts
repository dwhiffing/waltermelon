import { Scene } from 'phaser'

export class MenuScene extends Scene {
  score: number
  bgGraphics: Phaser.GameObjects.TileSprite
  constructor() {
    super('Menu')
  }

  init(opts: { score: number }) {
    this.score = opts.score
  }

  create() {
    const title = this.add.image(81, -55, 'title').setOrigin(0.5)

    this.bgGraphics = this.add
      .tileSprite(0, 0, 160, 144, 'bg')
      .setOrigin(0)
      .setDepth(-1)

    const text = this.add
      .bitmapText(80, 120, 'wayfarer', 'PRESS Z TO START')
      .setTintFill(0xfcdeea)
      .setOrigin(0.5)
      .setAlpha(0)

    this.tweens.add({
      targets: title,
      y: 55,
      duration: 5000,
      delay: 2000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: title,
          y: 50,
          duration: 1000,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })
        let state = 0
        text.setAlpha(1)
        this.time.addEvent({
          repeat: -1,
          delay: 850,
          callback: () => {
            state = state ? 0 : 1
            text.setTintFill(state ? 0x265935 : 0xfcdeea)
          },
        })
      },
    })

    this.input.keyboard?.once('keydown-Z', () => {
      this.sound.play('jump')
      this.scene.launch('Transition', { from: 'Menu', to: 'Game' })
    })
  }

  update() {
    this.bgGraphics.tilePositionX += 0.15
  }
}
