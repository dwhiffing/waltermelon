import { Scene } from 'phaser'

const START_Y = 77
const START_X = 320
export class IntroScene extends Scene {
  bgGraphics: Phaser.GameObjects.TileSprite
  crate: Phaser.GameObjects.Image
  particles: Phaser.GameObjects.Particles.ParticleEmitter
  player: Phaser.GameObjects.Sprite
  banana: Phaser.GameObjects.Sprite
  tilemap: Phaser.Tilemaps.Tilemap
  tileLayer: Phaser.Tilemaps.TilemapLayer
  crateLoop: Phaser.Time.TimerEvent
  text: Phaser.GameObjects.BitmapText
  startingGame = false

  constructor() {
    super('Intro')
  }

  create() {
    this.bgGraphics = this.add
      .tileSprite(-100, 0, 640, 200, 'bg')
      .setOrigin(0)
      .setDepth(-1)

    this.createTilemap()

    this.banana = this.add.sprite(START_X - 165, START_Y + 12, 'coin', 2)

    this.player = this.add.sprite(START_X, START_Y, 'player').setFlipX(true)

    this.crate = this.add.image(START_X + 1, START_Y - 16, 'crate').setDepth(5)
    this.startCrateLoop()

    this.player.play({
      key: 'player-walk-carry',
      repeat: -1,
      frameRate: 6,
    })
    this.cameras.main.startFollow(this.player, false, 1, 1, 0, 0)

    this.particles = this.add
      .particles(-20, -20, 'coin', {
        speedX: { min: -150, max: -100 },
        speedY: { min: -90, max: 20 },
        gravityY: 200,
        lifespan: 3000,
        frequency: 40,
      })
      .setDepth(1)
      .stop()

    this.text = this.add
      .bitmapText(
        5,
        105,
        'wayfarer',
        'Walter was on his way\n home from the melon\n           garden...',
      )
      .setLineSpacing(3)
      .setTintFill(0xfcdeea)
      .setFontSize(128)
      .setOrigin(0)
      .setDepth(20)
      .setScrollFactor(0)

    this.time.delayedCall(500, () => {
      this.input.keyboard?.once('keydown-Z', this.startGame)
      this.time.delayedCall(4500, () => {
        this.text.setText(
          '  When suddlenly the\n        most unlucky\n     thing happened!',
        )
      })

      this.add.tween({
        targets: [this.player, this.crate],
        x: 160,
        // duration: 1000,
        duration: 7000,
        onComplete: () => {
          this.crateLoop.destroy()
          this.time.addEvent({
            delay: 120,
            repeat: 8,
            callback: () => {
              this.crate.angle -= 90
            },
          })
          this.text.setText('')

          const CRATE_CRASH_TIME = 1500
          this.add.tween({
            targets: this.crate,
            x: 34,
            duration: CRATE_CRASH_TIME,
            onComplete: () => {
              this.sound.play('crate-land', { volume: 0.3 })
              this.time.delayedCall(100, () => {
                this.particles.x = this.crate.x - 5
                this.particles.y = this.crate.y
                this.particles.start()
                this.time.delayedCall(2500, () => this.particles.stop())
              })
            },
          })

          this.add.tween({
            targets: this.crate,
            y: 0,
            duration: CRATE_CRASH_TIME / 2,
            ease: 'Sine.easeOut',
            onComplete: () => {},
          })
          this.add.tween({
            targets: this.crate,
            y: 78,
            delay: CRATE_CRASH_TIME / 2,
            duration: CRATE_CRASH_TIME / 2,
            ease: 'Sine.easeIn',
          })
          this.banana.setAlpha(0)
          this.sound.play('slip', { volume: 0.3 })

          this.player.play({ key: 'player-roll', repeat: 2, frameRate: 12 })
          this.add.tween({
            targets: [this.cameras.main.followOffset],
            x: 60,
            duration: 1500,
            ease: 'Sine.easeInOut',
            onComplete: () => this.cameras.main.stopFollow(),
          })
          this.add.tween({
            targets: [this.player],
            x: 70,
            duration: 1000,
            onComplete: () => {
              this.player.play({ key: 'player-idle', repeat: -1, frameRate: 6 })
              this.time.delayedCall(600, () => {
                this.player.play({
                  key: 'player-sad',
                  repeat: -1,
                  frameRate: 12,
                })
                this.time.delayedCall(3500, () => {
                  this.player.setDepth(10)
                  this.walkToLedge()
                })
              })
            },
          })
        },
      })
    })
  }

  startCrateLoop = () => {
    const toggle = () =>
      (this.crate.y =
        this.crate.y === START_Y - 16 ? START_Y - 17 : START_Y - 16)

    this.time.delayedCall(0, () => {
      this.crateLoop = this.time.addEvent({
        delay: 1000,
        repeat: -1,
        callback: () => {
          this.time.delayedCall(320, toggle)
          this.time.delayedCall(486, toggle)
          this.time.delayedCall(818, toggle)
          this.time.delayedCall(984, toggle)
        },
      })
    })
  }

  walkToLedge = () => {
    this.player.play({ key: 'player-walk', repeat: -1, frameRate: 12 })
    this.add.tween({
      targets: this.player,
      x: 20,
      duration: 800,
      onComplete: this.jumpOffLedge,
    })
  }

  jumpOffLedge = () => {
    this.player.play({ key: 'player-idle', repeat: -1, frameRate: 6 })
    this.time.delayedCall(600, () => {
      this.player.play({ key: 'player-jump' })
      this.add.tween({
        targets: this.player,
        x: -30,
        duration: 1000,
      })
      this.add.tween({
        targets: this.player,
        y: 20,
        duration: 500,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.startGame()
          this.player.play({ key: 'player-fall' })
        },
      })
      this.add.tween({
        targets: this.player,
        y: 190,
        delay: 500,
        duration: 500,
        ease: 'Sine.easeIn',
      })
    })
  }

  createTilemap() {
    const N = 30
    // Hardcoded tile data for a simple intro scene (10x9 tiles, each 16x16 pixels)
    const tileData = [
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, () => -1),
      Array.from({ length: N }, (_, i) => (i === 0 ? 3 : i === N - 1 ? 1 : 1)),
      Array.from({ length: N }, (_, i) => (i === 0 ? 8 : i === N - 1 ? 9 : 9)),
      Array.from({ length: N }, (_, i) => (i === 0 ? 8 : i === N - 1 ? 9 : 9)),
      Array.from({ length: N }, (_, i) => (i === 0 ? 8 : i === N - 1 ? 9 : 9)),
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

  startGame = () => {
    if (this.startingGame) return
    this.startingGame = true
    this.sound.play('music', { loop: true, volume: 1 })
    this.scene.launch('Transition', { from: 'Intro', to: 'Menu' })
  }

  update() {}
}
