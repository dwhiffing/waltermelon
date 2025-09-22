import { Scene } from 'phaser'
import { Player } from '../sprites/Player'
import { GameMap } from '../sprites/GameMap'
import { GameTimer } from '../GameTimer'
import { WatermelonCompass } from '../sprites/WatermelonCompass'

export const tileSize = 16
const timeScale = 1
const MELON_PARTICLE: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
  {
    speedY: { min: -80, max: -120 },
    speedX: { min: -60, max: 60 },
    angle: { min: 240, max: 290 },
    gravityY: 220,
    frame: [1, 1, 1, 2, 0, 3],
    lifespan: { max: 800, min: 500 },
    scale: { start: 2, end: 0.5 },
  }

export class GameScene extends Scene {
  player: Player
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  zKey: Phaser.Input.Keyboard.Key
  xKey: Phaser.Input.Keyboard.Key
  gameMap: GameMap
  melonParticles: Phaser.GameObjects.Particles.ParticleEmitter
  dustParticles: Phaser.GameObjects.Particles.ParticleEmitter
  dustParticles2: Phaser.GameObjects.Particles.ParticleEmitter
  panTween: Phaser.Tweens.Tween | null = null
  isPanned: boolean
  coinCount: number = 0
  coinText: Phaser.GameObjects.BitmapText
  coinIcon: Phaser.GameObjects.Sprite
  coinTween: Phaser.Tweens.Tween | null = null
  coinsTimer: Phaser.Time.TimerEvent | null = null
  watermelonCompass: WatermelonCompass

  constructor() {
    super('Game')
  }

  create() {
    this.time.timeScale = timeScale
    this.anims.globalTimeScale = timeScale
    this.physics.world.timeScale = 1 / timeScale
    this.tweens.timeScale = timeScale

    this.gameMap = new GameMap(this)

    this.player = new Player(this)
    this.watermelonCompass = new WatermelonCompass(this, this.player)
    this.melonParticles = this.add
      .particles(0, 0, 'bits', MELON_PARTICLE)
      .setDepth(60)
    this.dustParticles = this.add.particles(0, 0, 'bits').setDepth(1)
    this.dustParticles2 = this.add.particles(0, 0, 'bits').setDepth(20)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.zKey.on('down', this.player.startJump, this)
    this.zKey.on('up', this.player.endJump, this)

    let lastv = 0
    this.physics.add.collider(
      this.player,
      this.gameMap.tileLayer,
      () => {
        if (this.player.body.blocked.up) this.player.body.velocity.y = lastv
      },
      () => {
        lastv = this.player.body.velocity.y
        return !this.player.hangingLedge && !this.player.onSlope
      },
    )
    this.physics.add.overlap(this.player, this.gameMap.coins, this.collectCoin)
    this.gameMap.movingTileSprites.forEach((tile) => {
      this.physics.add.collider(this.player, tile)
    })

    this.cameras.main.startFollow(this.player, false, 1, 1, 0, 0)
    this.cameras.main.setBackgroundColor('#012824')

    this.createCoinCounter()
    GameTimer.start()
  }

  update() {
    this.player.update()
    this.watermelonCompass.update()
    this.handleCameraPan()
    this.gameMap.update()
  }

  handleCameraPan() {
    const x = this.player.flipX ? 50 : -50
    if (!this.player.onGround || this.player.body.velocity.x !== 0) return
    if (this.cursors.up.isDown) {
      const duration = this.time.now - this.cursors.up.timeDown
      if (duration >= 500) {
        if (!this.isPanned) this.player.play('player-look', true)
        this.startCameraPan(x, 50)
      }
    } else if (this.cursors.down.isDown) {
      const duration = this.time.now - this.cursors.down.timeDown
      if (duration >= 500) this.startCameraPan(x, -70)
    } else {
      this.stopCameraPan()
    }
  }

  startCameraPan(x = 0, y = 50) {
    if (this.isPanned) return

    this.isPanned = true
    const ease = 'Sine.easeInOut'
    const targets = this.cameras.main.followOffset
    const duration = 600
    this.panTween = this.tweens.add({ targets, x, y, duration, ease })
  }

  stopCameraPan() {
    if (!this.isPanned) return

    if (this.player.anims.currentAnim?.key === 'player-look')
      this.player
        .playReverse('player-look', true)
        .once('animationcomplete', () => this.player.play('player-idle', true))
    this.isPanned = false
    const ease = 'Sine.easeInOut'
    const targets = this.cameras.main.followOffset
    const duration = 600
    this.panTween?.stop()
    this.panTween = this.tweens.add({ targets, x: 0, y: 0, duration, ease })
  }

  collectCoin = (_player: any, coin: any) => {
    this.gameMap.coins.remove(coin)
    if (coin.name === 'special') this.watermelonCompass.active = true
    coin.destroy()
    this.sound.play('coin', {
      volume: 0.5,
      rate: 1 + (Math.random() * 0.4 - 0.2),
    })
    this.melonParticles.explode(12, coin.x + 4, coin.y - 8)

    this.coinCount++
    this.showCoinCounter()

    if (this.coinCount >= this.gameMap.totalCoins) this.onWin()
  }

  createCoinCounter() {
    const x = 180
    const y = 10

    this.coinIcon = this.add
      .sprite(x, y, 'coin', 0)
      .setScrollFactor(0)
      .setDepth(100)

    this.coinText = this.add
      .bitmapText(x + 12, y - 4, 'wayfarer', '0')
      .setScrollFactor(0)
      .setTintFill(0xfcdeea)
      .setDepth(100)
  }

  showCoinCounter() {
    this.coinText.setText(this.coinCount.toString())
    this.coinsTimer?.destroy()
    this.coinsTimer = null

    this.coinTween?.stop()
    this.coinTween = this.tweens.add({
      targets: [this.coinIcon, this.coinText],
      x: 130,
      duration: 800,
      ease: 'Back.easeOut',
      onUpdate: () => {
        this.coinText.x = this.coinIcon.x + 11
      },
      onComplete: this.startHideTimer,
    })
  }

  startHideTimer = () => {
    this.coinsTimer?.destroy()
    this.coinsTimer = this.time.delayedCall(1000, this.hideCoinCounter)
  }

  hideCoinCounter = () => {
    this.coinTween?.stop()
    this.coinTween = this.tweens.add({
      targets: [this.coinIcon, this.coinText],
      x: 180,
      duration: 800,
      ease: 'Back.easeIn',
      onUpdate: () => {
        this.coinText.x = this.coinIcon.x + 11
      },
    })
  }

  asyncCall = (time: number) =>
    new Promise((resolve) => this.time.delayedCall(time, resolve))

  onWin = () => {
    GameTimer.stop()
    this.scene.launch('Transition', { from: 'Game', to: 'Win' })
  }
}
