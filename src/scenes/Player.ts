import { GameScene, tileSize } from './Game'

const SPEED = 250
const MAX_SPEED = 100
const JUMP_HEIGHT = 180
const DRAG = 220
const AIR_CONTROL_PERCENT = 0.3
const ROLL_SPEED = 200
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body
  scene: GameScene
  previousDirection = 0
  rollDirection = 0
  slopeDirection = 0
  isSkidding = false
  isRunning = false
  isCrouching = false
  isExitingCrouch = false
  isPullingUp = false
  hangingLedge: { x: number; y: number; direction: number } | null = null

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
    const isHoldingDown = this.scene.cursors.down.isDown
    const v = body.velocity.x
    const speed = Math.abs(v)
    const moveDir = v > 5 ? 1 : v < -5 ? -1 : 0

    this.setDepth(this.hangingLedge ? -1 : 10)

    if (this.hangingLedge) {
      body.setVelocity(0, 0).setAcceleration(0, 0)

      this.x = this.hangingLedge.x
      this.y = this.hangingLedge.y
      if (!this.isPullingUp) {
        if (this.scene.xKey.isDown) this.startPullUp()
        if (isHoldingDown) this.dropFromHang()
      }
      return
    }
    // if (!this.hangingLedge && !this.onGround && body.velocity.y > 0) this.detectLedge()

    // update states and animations
    this.setDrag(
      this.onGround && !this.isRolling ? (this.isRunning ? DRAG : DRAG * 2) : 0,
      0,
    )

    if (!this.onSlope && !this.isRolling) this.body.setAccelerationX(0)

    if (speed < 5 && this.isRunning) this.isRunning = false

    if (
      !this.onSlope &&
      !this.isRolling &&
      body.velocity.y > 0 &&
      this.anims.currentAnim!.key !== 'player-jump3'
    ) {
      this.play({ key: 'player-jump3' }, true)
    }

    if (this.onGround) {
      const shouldStartCrouch =
        isHoldingDown && !this.isCrouching && !this.isExitingCrouch && speed < 5
      const shouldEndCrouch = !isHoldingDown && this.isCrouching && speed < 5
      const shouldRoll = isHoldingDown && this.isRunning && speed > 80

      const shouldStartSkid =
        !this.isSkidding &&
        !this.isRolling &&
        this.isRunning &&
        this.isChangingDirection
      const shouldStopSkid =
        this.isSkidding &&
        (this.inputDirection === moveDir || Math.abs(body.velocity.x) < 5)

      if (shouldRoll) this.roll()
      if (shouldStartCrouch) {
        this.isCrouching = true
        this.play('player-crouch', true)
      }
      if (shouldEndCrouch) {
        this.isExitingCrouch = true
        this.play({ key: 'player-uncrouch' }, true)
        this.once('animationcomplete', this.onCrouchExitComplete)
      }

      if (shouldStartSkid) {
        this.isSkidding = true
        this.play('player-skid', true)
      }
      if (shouldStopSkid) this.isSkidding = false

      if (this.onSlope) {
        // force roll when pressing down on slope
        if (!this.isRolling && isHoldingDown) {
          this.body.velocity.x *= 0.4
          this.rollDirection = this.slopeDirection
        }
        const isRolling = this.rollDirection !== 0
        const isAgainst = moveDir !== this.slopeDirection
        const dx = isRolling && isAgainst ? -250 : -100
        const mx = isAgainst ? (isRolling ? 80 : 40) : MAX_SPEED
        this.setFlipX(isRolling ? moveDir === -1 : this.slopeDirection < 0)
        this.setDrag(isRolling ? 0 : 9)
        this.body.setAccelerationX(this.slopeDirection * dx)
        this.body.setMaxVelocity(mx, 1000)

        if (isRolling) {
          this.play({ key: 'player-roll', frameRate: 8 }, true)
          this.once('animationcomplete', this.onRollComplete)
        } else {
          this.play('player-slope-slide', true)
        }
      }

      if (
        !this.isSkidding &&
        !this.isCrouching &&
        !this.isExitingCrouch &&
        !this.isRolling &&
        !this.onSlope
      ) {
        const key = `player-${
          speed === 0 ? 'idle' : this.isRunning ? 'run' : 'walk'
        }`
        this.play({ key, frameRate: speed === 0 ? 4 : 8 }, true)
      }
    }

    this.handleInput()
    this.handleSlope()
  }

  handleInput = () => {
    if (!this.canInput) return

    let speed = this.isRunning ? SPEED : SPEED * 0.5
    let maxSpeed = this.isRunning ? MAX_SPEED : MAX_SPEED * 0.5

    this.setMaxVelocity(maxSpeed, 1000)

    const controlMultiplier = this.isChangingDirection
      ? 0
      : this.onGround
      ? 1
      : AIR_CONTROL_PERCENT
    if (this.scene.cursors.left.isDown) {
      this.setFlipX(true)
      this.previousDirection = -1
      this.body.setAccelerationX(-speed * controlMultiplier)
    } else if (this.scene.cursors.right.isDown) {
      this.setFlipX(false)
      this.previousDirection = 1
      this.body.setAccelerationX(speed * controlMultiplier)
    } else {
      this.previousDirection = 0
    }
  }

  handleSlope() {
    let slopeDirection = 0
    const v = this.body.velocity.x
    const moveDir = v > 5 ? 1 : v < -5 ? -1 : 0

    if (this.body.velocity.y < 0) return

    for (const tile of this.getAdjacentTiles()) {
      if (tile?.index !== 4 && tile?.index !== 5) continue
      const slopeY = this.getSlope(tile)
      if (!slopeY) continue

      slopeDirection = tile?.index === 4 ? 1 : -1

      if (this.slopeDirection === 0) {
        if (
          this.body.velocity.y > 10 ||
          (Math.abs(this.body.velocity.x) > 70 && moveDir !== slopeDirection)
        )
          this.rollDirection = slopeDirection

        this.body.velocity.x *= 0.8
      }

      const t = Math.abs(Math.round(slopeY) - this.y)
      if (t < 3) {
        this.y = Math.round(slopeY)
        this.body.setVelocityY(0)
      }

      break
    }

    this.slopeDirection = slopeDirection
  }

  getSlope(tile: Phaser.Tilemaps.Tile): number | null {
    const tx = tile.x * tileSize
    const ty = tile.y * tileSize
    const px = this.body.x + this.body.width / 2
    const py = this.body.y + this.body.height / 2

    if (Math.abs(py - ty) > 10) return null
    if (px < tx || px > tx + tileSize) return null

    const relativeX = (px - tx) / tileSize

    if (tile.index === 4) {
      return ty + tileSize - relativeX * tileSize
    } else if (tile.index === 5) {
      return ty + relativeX * tileSize
    }

    return null
  }

  jump = () => {
    if (
      !this.onGround ||
      this.isRolling ||
      this.isCrouching ||
      this.isExitingCrouch
    )
      return

    this.scene.time.delayedCall(10, () => this.play('player-jump'))

    // jump off of slope
    if (this.onSlope) {
      this.body.setVelocityX(this.slopeDirection * -25)
      this.body.setVelocityY(-(JUMP_HEIGHT / 1.5))
      this.slopeDirection = 0
    } else {
      this.body.setVelocityY(-JUMP_HEIGHT)
    }
  }

  // crouch/roll
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

    body.setVelocityX(this.rollDirection * ROLL_SPEED)

    this.setDrag(0, 0)
      .play({ key: 'player-roll', frameRate: 10 })
      .once('animationcomplete', this.onRollComplete)
  }

  onRollComplete = () => {
    if (this.onSlope) return
    this.rollDirection = 0
    this.play('player-idle')
  }

  onCrouchExitComplete = () => {
    this.isCrouching = false
    this.isExitingCrouch = false
    this.play('player-idle', true)
  }

  // ledges
  detectLedge = (): { x: number; y: number; direction: number } | null => {
    const body = this.body as Phaser.Physics.Arcade.Body

    const touchingLeft = body.touching.left || body.blocked.left
    const touchingRight = body.touching.right || body.blocked.right

    if (touchingLeft || touchingRight) {
      const direction = touchingLeft ? -1 : 1

      this.grabLedge({
        x: this.x + (touchingLeft ? -9 : 9),
        y: this.y + 7,
        direction: direction,
      })
    }

    return null
  }

  grabLedge = (ledge: { x: number; y: number; direction: number }) => {
    const body = this.body as Phaser.Physics.Arcade.Body

    this.hangingLedge = {
      x: ledge.x + (ledge.direction > 0 ? 3 : -3),
      y: ledge.y - 18,
      direction: ledge.direction,
    }
    body.setVelocity(0, 0).setAcceleration(0, 0)
    this.setFlipX(ledge.direction < 0).play('player-hang', true)
  }

  startPullUp = () => {
    if (!this.hangingLedge || this.isPullingUp) return

    this.isPullingUp = true
    this.play({ key: 'player-pull-up', frameRate: 7 })
    this.once('animationcomplete', this.dropFromHang)
  }

  dropFromHang = () => {
    this.isPullingUp = false
    this.hangingLedge = null
  }

  // misc

  getAdjacentTiles() {
    const body = this.body
    const centerTileX = Math.floor((body.x + body.width / 2) / tileSize)
    const bottomTileY = Math.floor((body.y + body.height - 2) / tileSize)

    let tiles = []

    for (let x = centerTileX - 1; x <= centerTileX + 1; x++) {
      for (let y = bottomTileY; y <= bottomTileY + 1; y++) {
        const tile = this.scene.layer.getTileAt(x, y)
        if (tile) tiles.push(tile)
      }
    }
    return tiles
  }

  toggleRunning = () => {
    if (this.onSlope) return
    this.isRunning = true
  }

  get canInput() {
    const notCrouched = !this.isCrouching && !this.isExitingCrouch
    const notHanging = !this.hangingLedge && !this.isPullingUp
    return notCrouched && notHanging && !this.isRolling && !this.onSlope
  }

  get onGround() {
    return this.body.blocked.down || this.onSlope
  }

  get isRolling() {
    return this.rollDirection !== 0
  }

  get onSlope() {
    return this.slopeDirection !== 0
  }

  get inputDirection() {
    return this.scene.cursors.left.isDown
      ? -1
      : this.scene.cursors.right.isDown
      ? 1
      : 0
  }

  get isChangingDirection() {
    return (
      this.inputDirection !== 0 &&
      this.previousDirection !== 0 &&
      this.inputDirection !== this.previousDirection
    )
  }
}

const getProperty = (o: any, k: string) =>
  o.properties.find((p: any) => p.name === k)
