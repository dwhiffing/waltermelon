import { Scene } from 'phaser'

export class MenuScene extends Scene {
  score: number
  constructor() {
    super('Menu')
  }

  init(opts: { score: number }) {
    this.score = opts.score
  }

  create() {
    this.cameras.main.setBackgroundColor(0x87cf90)

    let state = 0
    this.time.addEvent({
      repeat: -1,
      delay: 700,
      callback: () => {
        state = state ? 0 : 1
        text.setTintFill(state ? 0x000000 : 0x5d5fbf)
      },
    })

    const text = this.add
      .bitmapText(80, this.cameras.main.height / 2, 'wayfarer', 'PRESS ENTER')
      .setTintFill(0x000000)
      .setOrigin(0.5)

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start('Game')
    })
  }
}
