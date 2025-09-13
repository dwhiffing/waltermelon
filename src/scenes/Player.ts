import { GameScene } from './Game'

const SPEED = 80
const JUMP_HEIGHT = 200
const DRAG = 300
export class Player extends Phaser.Physics.Arcade.Sprite {
  player: Phaser.Physics.Arcade.Sprite
  scene: GameScene

  constructor(scene: GameScene) {
    const spawn = scene.map.findObject('Spawn', (o) => o.name === 'spawn') ?? {
      x: 0,
      y: 0,
    }

    super(scene, spawn.x ?? 0, spawn.y ?? 0, 'player')
    this.scene = scene

    const flip = !!getProperty(spawn, 'flip')

    this.scene.physics.add.existing(this)
    this.scene.add.existing(this)
    this.play('player-jump')
      .setBodySize(12, 20)
      .setOffset(10, 12)
      .setFlipX(!!flip)
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body

    if (body.blocked.down) {
      this.play('player-walk', true).setDrag(DRAG, 0)
    } else {
      this.play('player-jump').setDrag(0, 0)
    }

    if (this.scene.cursors.left.isDown && body.blocked.down) {
      body.setVelocityX(-SPEED)
      this.setFlipX(false)
    } else if (this.scene.cursors.right.isDown && body.blocked.down) {
      body.setVelocityX(SPEED)
      this.setFlipX(true)
    } else if (body.blocked.down) {
      this.play('player-stand')
    }
  }
  jump = () => {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.down) {
      this.scene.time.delayedCall(10, () => {
        this.play('player-jump')
      })
      body.setVelocityY(-JUMP_HEIGHT)
    }
  }
}

const getProperty = (o: any, k: string) =>
  o.properties.find((p: any) => p.name === k)
