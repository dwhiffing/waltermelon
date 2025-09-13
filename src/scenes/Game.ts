import { Scene } from 'phaser'
import { Player } from './Player'

export class GameScene extends Scene {
  player: Player
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  zKey: Phaser.Input.Keyboard.Key
  xKey: Phaser.Input.Keyboard.Key
  map: Phaser.Tilemaps.Tilemap
  pickups: Phaser.Tilemaps.Tile[]

  constructor() {
    super('Game')
  }

  create() {
    this.map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 })
    const tileset = this.map.addTilesetImage('tiles')!
    const layer = this.map.createLayer('Level1', tileset)!
    this.map.setCollision([1, 2, 3, 4, 5, 6, 7, 8])
    this.pickups = this.map.filterTiles((tile: any) => tile.index === 82)!

    const spawn = this.map.findObject('Objects', (o) => o.name === 'spawn')!
    const playerFlip = !!getProperty(spawn, 'flip')
    this.player = new Player(this, spawn.x, spawn.y, playerFlip)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.zKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.zKey.on('down', this.player.jump, this)

    this.physics.add.collider(this.player, layer)
    this.cameras.main.startFollow(this.player)
  }

  update() {
    this.player.update()
    this.physics.world.overlapTiles(this.player, this.pickups, this.hitPickup)
  }

  hitPickup = (_player: any, tile: any) => {
    this.map.removeTile(tile, 29, false)

    this.pickups = this.map.filterTiles((tile: any) => tile.index === 82)!
  }

  asyncCall = (time: number) =>
    new Promise((resolve) => this.time.delayedCall(time, resolve))
}

const getProperty = (o: any, k: string) =>
  o.properties.find((p: any) => p.name === k)
