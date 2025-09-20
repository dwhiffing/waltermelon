import { Scene } from 'phaser'
import { Player } from '../sprites/Player'
import { GameMap } from '../sprites/GameMap'
import { GameTimer } from '../GameTimer'

export const tileSize = 16
const timeScale = 1
const MELON_PARTICLE: any = {
  speedY: { min: -50, max: -120 },
  speedX: { min: -60, max: 60 },
  angle: { min: 240, max: 290 },
  gravityY: 240,
  lifespan: { max: 1200, min: 500 },
  scale: { start: 2, end: 0 },
}

export class GameScene extends Scene {
  player: Player
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  zKey: Phaser.Input.Keyboard.Key
  xKey: Phaser.Input.Keyboard.Key
  gameMap: GameMap
  particles: Phaser.GameObjects.Particles.ParticleEmitter
  panTween: Phaser.Tweens.Tween | null = null
  isPanned: boolean
  coinCount: number = 0
  cointText: Phaser.GameObjects.BitmapText
  coinIcon: Phaser.GameObjects.Sprite
  coinTween: Phaser.Tweens.Tween | null = null
  coinsTimer: Phaser.Time.TimerEvent | null = null

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
    this.particles = this.add
      .particles(0, 0, 'bits', MELON_PARTICLE)
      .setDepth(40)

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
    coin.destroy()
    this.sound.play('coin', {
      volume: 1.5,
      rate: 1 + (Math.random() * 0.4 - 0.2),
    })
    this.particles.explode(8, this.player.x - 4, this.player.y + 9)

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

    this.cointText = this.add
      .bitmapText(x + 12, y - 4, 'wayfarer', '0')
      .setScrollFactor(0)
      .setTintFill(0xfcdeea)
      .setDepth(100)
  }

  showCoinCounter() {
    this.cointText.setText(this.coinCount.toString())
    this.coinsTimer?.destroy()
    this.coinsTimer = null

    this.coinTween?.stop()
    this.coinTween = this.tweens.add({
      targets: [this.coinIcon, this.cointText],
      x: 130,
      duration: 800,
      ease: 'Back.easeOut',
      onUpdate: () => {
        this.cointText.x = this.coinIcon.x + 11
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
      targets: [this.coinIcon, this.cointText],
      x: 180,
      duration: 800,
      ease: 'Back.easeIn',
      onUpdate: () => {
        this.cointText.x = this.coinIcon.x + 11
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
