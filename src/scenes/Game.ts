import { Scene } from 'phaser'
import { Player } from './Player'

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
  map: Phaser.Tilemaps.Tilemap
  layer: Phaser.Tilemaps.TilemapLayer
  coins: Phaser.Physics.Arcade.Group
  debugGraphics: Phaser.GameObjects.Graphics
  bgGraphics: Phaser.GameObjects.TileSprite
  particles: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super('Game')
  }

  create() {
    this.time.timeScale = timeScale
    this.anims.globalTimeScale = timeScale
    this.physics.world.timeScale = 1 / timeScale

    this.loadMap()
    this.bgGraphics = this.add
      .tileSprite(0, 0, this.map.widthInPixels, this.map.heightInPixels, 'bg')
      .setOrigin(0)
      .setDepth(-1)

    this.player = new Player(this)
    this.debugGraphics = this.add.graphics()
    this.particles = this.add
      .particles(0, 0, 'bits', MELON_PARTICLE)
      .setDepth(40)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.zKey.on('down', this.player.jump, this)

    this.physics.add.collider(
      this.player,
      this.layer,
      () => {},
      () => !this.player.hangingLedge && !this.player.onSlope,
    )
    this.physics.add.overlap(this.player, this.coins, this.collectCoin)
    this.cameras.main.startFollow(this.player, false, 1, 1, 0, 0)
  }

  update() {
    this.player.update()
    if (this.physics.config.debug) this.drawTilePhysicsBodies()
  }

  loadMap() {
    this.map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 })
    const tileset = this.map.addTilesetImage('tiles')!
    this.layer = this.map.createLayer('Level', tileset)!
    this.map.setCollision([1, 2, 3, 6, 7, 8, 9, 13, 14, 15])

    this.coins = this.physics.add.group()
    this.map.getObjectLayer('Coins')!.objects.forEach(({ x, y }) => {
      const coin = this.physics.add
        .sprite(x!, y! - 2, 'coin')
        .setOrigin(0, 1)
        .setBodySize(10, 10)
      this.coins.add(coin)
      this.tweens.add({
        targets: coin,
        y: y! - 4,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      coin.body.setAllowGravity(false)
    })
  }

  collectCoin = (_player: any, coin: any) => {
    this.coins.remove(coin)
    coin.destroy()
    this.particles.explode(8, this.player.x - 4, this.player.y + 9)
  }

  drawTilePhysicsBodies() {
    this.debugGraphics.clear()

    const adjacent = this.player.getAdjacentTiles()

    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        const tile = this.layer.getTileAt(x, y)
        if (!tile || (!tile?.collides && tile.index !== 4 && tile.index !== 5))
          continue

        const color = adjacent.includes(tile) ? 0x00ff00 : 0xff0000
        const worldX = x * tileSize
        const worldY = y * tileSize
        this.debugGraphics.lineStyle(1, color, 0.8)
        this.debugGraphics
          .fillStyle(color, 0.2)
          .fillRect(worldX, worldY, tileSize, tileSize)
          .strokeRect(worldX, worldY, tileSize, tileSize)
      }
    }
  }

  asyncCall = (time: number) =>
    new Promise((resolve) => this.time.delayedCall(time, resolve))
}
