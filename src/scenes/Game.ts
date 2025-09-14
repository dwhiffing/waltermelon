import { Scene } from 'phaser'
import { Player } from './Player'

export class GameScene extends Scene {
  player: Player
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  zKey: Phaser.Input.Keyboard.Key
  xKey: Phaser.Input.Keyboard.Key
  map: Phaser.Tilemaps.Tilemap
  layer: Phaser.Tilemaps.TilemapLayer
  coins: Phaser.Physics.Arcade.Group

  constructor() {
    super('Game')
  }

  create() {
    this.loadMap()

    this.player = new Player(this)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.zKey.on('down', this.player.jump, this)
    this.xKey.on('down', this.player.roll, this)

    this.physics.add.collider(this.player, this.layer)
    this.physics.add.overlap(this.player, this.coins, this.collectCoin)
    this.cameras.main.startFollow(this.player)
  }

  update() {
    this.player.update()
  }

  loadMap() {
    this.map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 })
    const tileset = this.map.addTilesetImage('tiles')!
    this.layer = this.map.createLayer('Level', tileset)!
    this.map.setCollision([1, 2, 3, 4, 5, 6, 7, 8])

    this.coins = this.physics.add.group()
    this.map.getObjectLayer('Coins')!.objects.forEach(({ x, y }) => {
      const coin = this.physics.add
        .sprite(x!, y!, 'coin')
        .setOrigin(0, 1)
        .setBodySize(10, 10)
      this.coins.add(coin)
      coin.body.setAllowGravity(false)
    })
  }

  collectCoin = (_player: any, coin: any) => {
    this.coins.remove(coin)
    coin.destroy()
  }

  asyncCall = (time: number) =>
    new Promise((resolve) => this.time.delayedCall(time, resolve))
}
