import { GameScene } from './Game'

const SPEED = 250
const MAX_SPEED = 100
const JUMP_HEIGHT = 200
const DRAG = 220
const AIR_CONTROL_PERCENT = 0.3
const ROLL_SPEED = 200
export class Player extends Phaser.Physics.Arcade.Sprite {
  player: Phaser.Physics.Arcade.Sprite
  scene: GameScene
  fallFlag = false
  previousDirection = 0
  isSkidding = false
  isRolling = false
  rollDirection = 0
  isCrouching = false
  isExitingCrouch = false

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
      .setMaxVelocity(MAX_SPEED, 1000)
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body
    const c = this.scene.cursors

    if (this.isRolling) {
      this.setFlipX(this.rollDirection < 0)
      return
    }

    if (body.blocked.down) {
      this.setDrag(DRAG, 0)
      this.fallFlag = false

      const inputDir = c.left.isDown ? -1 : c.right.isDown ? 1 : 0
      const moveDir = body.velocity.x > 5 ? 1 : body.velocity.x < -5 ? -1 : 0

      if (c.down.isDown && Math.abs(body.velocity.x) < 5) {
        if (!this.isCrouching && !this.isExitingCrouch) {
          this.isCrouching = true
          this.play('player-crouch', true)
        }
      } else {
        if (this.isCrouching && !this.isExitingCrouch) {
          this.isExitingCrouch = true
          this.play({ key: 'player-uncrouch' }, true)
          this.once('animationcomplete', this.onCrouchExitComplete)
        }
      }

      if (inputDir !== 0 && moveDir !== 0 && inputDir !== moveDir) {
        if (!this.isSkidding) {
          this.isSkidding = true
          this.play('player-skid', true)
        }
      } else {
        if (
          this.isSkidding &&
          (inputDir === moveDir || Math.abs(body.velocity.x) < 5)
        ) {
          this.isSkidding = false
        }
      }

      if (!this.isSkidding && !this.isCrouching && !this.isExitingCrouch) {
        if (body.velocity.x === 0) {
          this.play({ key: 'player-idle', frameRate: 4 }, true)
        } else {
          if (Math.abs(body.velocity.x) > 80) {
            this.play({ key: 'player-run', frameRate: 8 }, true)
          } else {
            this.play({ key: 'player-walk', frameRate: 8 }, true)
          }
        }
      }
    } else {
      this.setDrag(0)
      this.isSkidding = false // Can't skid in air
      this.isCrouching = false // Can't crouch in air
      this.isExitingCrouch = false // Cancel crouch exit in air
      if (body.velocity.y < 0) {
        this.play('player-jump', true)
      } else if (!this.fallFlag) {
        this.fallFlag = true
        this.play({ key: 'player-jump3' }, true)
      }
    }

    body.setAccelerationX(0)

    if (this.isRolling || this.isCrouching || this.isExitingCrouch) return

    const isOnGround = body.blocked.down
    const controlMultiplier = isOnGround ? 1.0 : AIR_CONTROL_PERCENT

    if (this.scene.cursors.left.isDown) {
      this.setFlipX(true)
      this.previousDirection = -1
      if (isOnGround) {
        body.setAccelerationX(body.velocity.x <= 0 ? -SPEED : 0)
      } else {
        body.setAccelerationX(-SPEED * controlMultiplier)
      }
    } else if (this.scene.cursors.right.isDown) {
      this.setFlipX(false)
      this.previousDirection = 1
      if (isOnGround) {
        body.setAccelerationX(body.velocity.x >= 0 ? SPEED : 0)
      } else {
        body.setAccelerationX(SPEED * controlMultiplier)
      }
    } else {
      this.previousDirection = 0
    }
  }

  roll = () => {
    const body = this.body as Phaser.Physics.Arcade.Body

    if (
      !body.blocked.down ||
      this.isRolling ||
      this.isCrouching ||
      this.isExitingCrouch
    )
      return

    this.rollDirection =
      this.previousDirection !== 0
        ? this.previousDirection
        : this.flipX
        ? -1
        : 1

    this.isRolling = true
    this.isSkidding = false

    body.setVelocityX(this.rollDirection * ROLL_SPEED)

    this.setDrag(0, 0)
      .play('player-roll')
      .once('animationcomplete', this.onRollComplete)
  }

  onRollComplete = () => {
    this.isRolling = false
    this.rollDirection = 0
    this.setDrag(DRAG, 0).play('player-idle')
  }

  onCrouchExitComplete = () => {
    this.isCrouching = false
    this.isExitingCrouch = false
    this.play('player-idle', true)
  }

  jump = () => {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.down && !this.isCrouching && !this.isExitingCrouch) {
      this.scene.time.delayedCall(10, () => {
        this.play('player-jump')
      })
      body.setVelocityY(-JUMP_HEIGHT)
    }
  }
}

const getProperty = (o: any, k: string) =>
  o.properties.find((p: any) => p.name === k)
