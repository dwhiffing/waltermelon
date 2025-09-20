import { Scene } from 'phaser'

const timeScale = 1
const START_Y = 77
const START_X = 80
const CONFETTI_PARTICLE: any = {
  speedY: { min: 20, max: 40 },
  speedX: { min: -20, max: 20 },
  gravityY: 5,
  lifespan: 8000,
  frequency: 150,
  quantity: 1,
}
export class WinScene extends Scene {
  bgGraphics: Phaser.GameObjects.TileSprite
  crate: Phaser.GameObjects.Image
  particles: Phaser.GameObjects.Particles.ParticleEmitter
  player: Phaser.GameObjects.Sprite
  tilemap: Phaser.Tilemaps.Tilemap
  tileLayer: Phaser.Tilemaps.TilemapLayer
  text: Phaser.GameObjects.BitmapText
  startingGame = false
  typewriterEvent: Phaser.Time.TimerEvent
  targetText = ''
  currentText = ''

  constructor() {
    super('Win')
  }

  create() {
    this.time.timeScale = timeScale
    this.anims.globalTimeScale = timeScale
    this.physics.world.timeScale = 1 / timeScale
    this.tweens.timeScale = timeScale

    this.bgGraphics = this.add
      .tileSprite(-100, 0, 640, 200, 'bg')
      .setOrigin(0)
      .setDepth(-1)

    this.createTilemap()

    this.particles = this.add
      .particles(-20, -10, 'bits', {
        x: { min: -0, max: 160 },
        y: -10,
        ...CONFETTI_PARTICLE,
      })
      .setDepth(-1)

    this.player = this.add
      .sprite(START_X + 17, START_Y, 'player')
      .setFlipX(true)
    this.crate = this.add
      .image(START_X - 17, START_Y - 1, 'crate-full')
      .setDepth(5)

    this.player.play({
      key: 'player-happy',
      repeat: -1,
      frameRate: 10,
    })

    this.text = this.add
      .bitmapText(5, 105, 'wayfarer', '')
      .setLineSpacing(3)
      .setTintFill(0xfcdeea)
      .setFontSize(128)
      .setOrigin(0)
      .setDepth(20)
      .setScrollFactor(0)

    this.time.delayedCall(1500, () => {
      this.input.keyboard?.once('keydown-Z', () => {
        this.sound.play('jump')
        this.startGame()
      })
    })
    this.time.delayedCall(1500, () => {
      this.typewriterText('\n            You win!', 100)
    })
  }

  typewriterText = (
    text: string,
    delay: number = 50,
    charsPerTick: number = 2,
  ) => {
    this.targetText = text
    this.currentText = ''
    this.text.setText('')

    if (this.typewriterEvent) {
      this.typewriterEvent.destroy()
    }

    let charIndex = 0
    this.typewriterEvent = this.time.addEvent({
      delay: delay,
      repeat: -1,
      callback: () => {
        if (charIndex >= this.targetText.length || this.startingGame) {
          this.typewriterEvent.destroy()
          return
        }

        let charsAdded = 0
        while (
          charsAdded < charsPerTick &&
          charIndex < this.targetText.length
        ) {
          const currentChar = this.targetText[charIndex]

          // If current character is a space, add all consecutive spaces at once
          if (currentChar === ' ') {
            let spaceCount = 0
            while (
              charIndex + spaceCount < this.targetText.length &&
              this.targetText[charIndex + spaceCount] === ' '
            ) {
              spaceCount++
            }
            this.currentText += ' '.repeat(spaceCount)
            charIndex += spaceCount
            charsAdded += spaceCount
          } else {
            this.currentText += currentChar
            charIndex++
            charsAdded++
          }
        }

        if (charIndex % 1 === 0)
          this.sound.play('voice', {
            volume: 0.05,
            rate: 0.8 + Math.random() * 0.1,
          })

        this.text.setText(this.currentText)
      },
    })
  }

  createTilemap() {
    const N = 10
    // Hardcoded tile data for a simple intro scene (10x9 tiles, each 16x16 pixels)
    const tileData = [
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => 1),
      Array.from({ length: N }, () => 9),
      Array.from({ length: N }, () => 9),
      Array.from({ length: N }, () => 9),
    ]

    this.tilemap = this.make.tilemap({
      data: tileData,
      tileWidth: 16,
      tileHeight: 16,
    })

    const tileset = this.tilemap.addTilesetImage('tiles')!

    this.tileLayer = this.tilemap
      .createLayer(0, tileset)!
      .setOrigin(0)
      .setDepth(0)
  }

  startGame = () => {}

  update() {}
}
