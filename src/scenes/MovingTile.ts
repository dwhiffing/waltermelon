import { GameScene, tileSize } from './Game'

export interface MovingTileConfig {
  x: number
  y: number
  targetX: number
  targetY: number
  gid: number
}

const POST_CYCLE_DELAY = 1500

export class MovingTile {
  scene: GameScene
  sprite: Phaser.Physics.Arcade.Sprite
  originX: number
  originY: number
  targetX: number
  targetY: number
  tween: Phaser.Tweens.Tween | null = null
  isMovingToTarget: boolean = true

  constructor(scene: GameScene, config: MovingTileConfig) {
    this.scene = scene
    this.originX = config.x
    this.originY = config.y - tileSize
    this.targetX = this.originX + config.targetX * 16
    this.targetY = this.originY + config.targetY * 16

    this.sprite = this.scene.physics.add
      .sprite(this.originX, this.originY, 'tiles', config.gid - 1)
      .setOrigin(0, 0)
      .setImmovable(true)
      .setBodySize(tileSize, tileSize)
    ;(this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

    this.startMovement()
  }

  startMovement() {
    if (this.tween) {
      this.tween.destroy()
    }

    const currentTarget = this.isMovingToTarget
      ? { x: this.targetX, y: this.targetY }
      : { x: this.originX, y: this.originY }

    let prevX = this.sprite.body!.x
    const manhattanDistance =
      Math.abs(this.sprite.x - currentTarget.x) +
      Math.abs(this.sprite.y - currentTarget.y)
    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x: currentTarget.x,
      y: currentTarget.y,
      duration: manhattanDistance * 20,
      ease: 'Quad.easeInOut',
      onUpdate: (_tween, target) => {
        const p = this.scene.player
        const deltaX = target.body.x - prevX
        prevX = target.body.x
        if (!p?.body?.touching.down || !target.body.touching.up) return
        p.x += deltaX
        if (p.body.velocity.y <= 180) p.y = target.body.y - (tileSize + 1)
      },
      onComplete: () => {
        this.isMovingToTarget = !this.isMovingToTarget
        this.scene.time.delayedCall(POST_CYCLE_DELAY, () => {
          if (this.sprite && this.sprite.active) this.startMovement()
        })
      },
    })
  }

  update() {}

  destroy() {
    this.tween?.destroy()
    this.tween = null
    this.sprite?.destroy()
  }

  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite
  }
}
