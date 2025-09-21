import { GameScene } from '../scenes/Game'
import { Player } from './Player'

const COMPASS_RADIUS = 20

export class WatermelonCompass extends Phaser.GameObjects.Sprite {
  scene: GameScene
  player: Player

  constructor(scene: GameScene, player: Player) {
    super(scene, player.x, player.y, 'coin', 1)

    this.scene = scene
    this.player = player

    scene.add.existing(this)

    this.setDepth(30).setOrigin(0.5, 0.5)
  }

  update() {
    const m = this.findClosestWatermelon()
    const p = this.player

    if (!m || p.hangingLedge) {
      this.setVisible(false)
      return
    }

    this.setVisible(true)

    const angle = Phaser.Math.Angle.Between(
      p.x,
      p.y + p.body.height / 2,
      m.x,
      m.y,
    )

    const compassX = p.x + Math.cos(angle) * COMPASS_RADIUS
    const compassY = p.y + Math.sin(angle) * COMPASS_RADIUS
    this.setPosition(compassX, compassY)
  }

  private findClosestWatermelon(): Phaser.Physics.Arcade.Sprite | null {
    const watermelons =
      this.scene.gameMap.coins.getChildren() as Phaser.Physics.Arcade.Sprite[]
    const p = this.player

    if (watermelons.length === 0) return null

    let closest: Phaser.Physics.Arcade.Sprite | null = null
    let shortest = Infinity

    for (const m of watermelons) {
      const distance = Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y)
      if (distance < 25) return null
      if (distance < shortest) {
        shortest = distance
        closest = m
      }
    }

    return closest
  }
}
