import { Scene } from 'phaser'

export class GameScene extends Scene {
  keys: Record<string, Phaser.Input.Keyboard.Key>
  player: Phaser.Physics.Arcade.Sprite
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  map: Phaser.Tilemaps.Tilemap
  pickups: Phaser.Tilemaps.Tile[]

  constructor() {
    super('Game')
  }

  create() {
    this.map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 })
    const tileset = this.map.addTilesetImage('tiles')!
    const layer = this.map.createLayer('Level1', tileset)!

    const { x, y, ...rest } = this.map.objects[0].objects[0]
    const playerFlip = !!rest.properties.find((p: any) => p.name === 'flip')
    this.map.setCollision([1, 2, 3, 4, 5, 6, 7, 8])

    this.player = this.physics.add
      .sprite(x ?? 0, y ?? 0, '')
      .play({ key: 'player-jump' })
      .setDrag(300, 0)
      .setBodySize(12, 20)
      .setOffset(10, 12)
      .setFlipX(playerFlip)

    this.pickups = this.map.filterTiles((tile: any) => tile.index === 82)!

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.cursors.up.on(
      'down',
      () => {
        const body = this.player.body as Phaser.Physics.Arcade.Body
        if (body.blocked.down) {
          this.time.delayedCall(50, () => {
            this.player.play('player-jump')
          })
          body.setVelocityY(-190)
        }
      },
      this,
    )

    this.physics.add.existing(this.player)
    this.physics.add.collider(this.player, layer)

    this.cameras.main.startFollow(this.player)
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body

    if (body.blocked.down) {
      this.player.play('player-walk', true)
    }
    if (this.cursors.left.isDown) {
      body.setVelocityX(-75)
      this.player.setFlipX(false)
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(75)
      this.player.setFlipX(true)
    } else if (body.blocked.down) {
      this.player.play('player-stand')
    }

    this.physics.world.overlapTiles(this.player, this.pickups, this.hitPickup)
  }

  hitPickup = (_player: any, tile: any) => {
    this.map.removeTile(tile, 29, false)

    this.pickups = this.map.filterTiles((tile: any) => tile.index === 82)!
  }

  asyncCall = (time: number) =>
    new Promise((resolve) => this.time.delayedCall(time, resolve))
}
