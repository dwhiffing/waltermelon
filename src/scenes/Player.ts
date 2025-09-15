import { GameScene, tileSize } from './Game'

const SPEED = 250
const MAX_SPEED = 100
const JUMP_HEIGHT = 180
const DRAG = 220
const AIR_CONTROL_PERCENT = 0.3
const ROLL_SPEED = 200
const SIZE_X = 5
const SIZE_Y = 20
const OFFSET_X = 14
const OFFSET_Y = 31
export class Player extends Phaser.Physics.Arcade.Sprite {
  dust: Phaser.GameObjects.Sprite
  declare body: Phaser.Physics.Arcade.Body
  scene: GameScene
  previousDirection = 0
  rollDirection = 0
  slopeDirection = 0
  isSkidding = false
  isRunning = false
  isLanding = false
  isCrouching = false
  isExitingCrouch = false
  isStartingCrouch = false
  isPullingUp = false
  lastVelocity = 0
  hangingLedge: { x: number; y: number; direction: number } | null = null

  constructor(scene: GameScene) {
    const spawn = scene.map.findObject('Spawn', (o) => o.name === 'spawn') ?? {
      x: 0,
      y: 0,
    }

    super(scene, spawn.x ?? 0, (spawn.y ?? 0) - OFFSET_Y, 'player')
    this.scene = scene

    const flip = !!getProperty(spawn, 'flip')

    this.scene.physics.add.existing(this)
    this.scene.add.existing(this)
    this.play('player-jump')
      .setBodySize(SIZE_X, SIZE_Y)
      .setOffset(OFFSET_X, OFFSET_Y)
      .setFlipX(!!flip)
      .setMaxVelocity(MAX_SPEED, 1000)

    this.dust = this.scene.add
      .sprite(0, 0, 'dust')
      .play({ key: 'dust-walk', repeat: -1 }, true)
  }

  update() {
    const isHoldingDown = this.scene.cursors.down.isDown
    const vx = this.body.velocity.x
    const vy = this.body.velocity.y
    const speed = Math.abs(vx)
    const moveDir = vx > 5 ? 1 : vx < -5 ? -1 : 0

    this.dust
      .setFlipX(this.flipX)
      .setPosition(this.x + (this.flipX ? 8 : -8), this.y + 4)
      .setVisible(this.isSkidding)

    this.setDepth(this.hangingLedge ? -1 : 10)

    if (this.hangingLedge) {
      this.body.setVelocity(0, 0).setAcceleration(0, 0)

      this.body.x = this.hangingLedge.x
      this.body.y = this.hangingLedge.y
      if (!this.isPullingUp) {
        if (this.scene.xKey.isDown) this.startPullUp()
        if (isHoldingDown) this.dropFromHang()
      }
      return
    }
    if (!this.hangingLedge && !this.onGround && vy > 0) this.handleLedge()

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
      !this.hangingLedge &&
      vy > 0 &&
      this.anims.currentAnim!.key !== 'player-jump3'
    ) {
      this.play({ key: 'player-jump3' }, true)
    }

    if (this.onGround) {
      let shouldStartCrouch =
        isHoldingDown && !this.isCrouching && !this.isExitingCrouch && speed < 5
      const shouldEndCrouch =
        !isHoldingDown &&
        !this.isStartingCrouch &&
        this.isCrouching &&
        speed < 5
      const shouldRoll = isHoldingDown && this.isRunning && speed > 80

      const shouldStartSkid =
        !this.isSkidding &&
        !this.isRolling &&
        this.isRunning &&
        this.isChangingDirection
      const shouldStopSkid =
        this.isSkidding && (this.inputDirection === moveDir || speed < 5)

      if (this.anims.currentAnim!.key === 'player-jump3') {
        const isFast = this.lastVelocity > 200
        this.play(
          { key: isFast ? 'player-uncrouch' : 'player-land', frameRate: 6 },
          true,
        )
        this.once('animationcomplete', () => (this.isLanding = false))
        this.isLanding = true
      }

      if (shouldRoll) this.roll()
      if (shouldStartCrouch) {
        this.isCrouching = true
        this.isStartingCrouch = true
        this.play({ key: 'player-crouch', frameRate: 8 }, true)
        this.once('animationcomplete', () => (this.isStartingCrouch = false))
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
        !this.isLanding &&
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
    this.lastVelocity = vy
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

    let prevDir
    if (this.scene.cursors.left.isDown) {
      this.setFlipX(true)
      this.body.setAccelerationX(-speed * controlMultiplier)
      prevDir = -1
    } else if (this.scene.cursors.right.isDown) {
      this.setFlipX(false)
      prevDir = 1
      this.body.setAccelerationX(speed * controlMultiplier)
    } else {
      prevDir = 0
    }
    if (typeof prevDir === 'number')
      this.scene.time.delayedCall(100, () => (this.previousDirection = prevDir))
  }

  handleSlope() {
    let slopeDirection = 0
    const { x: vx, y: vy } = this.body.velocity
    const speed = Math.abs(vx)
    const moveDir = vx > 5 ? 1 : vx < -5 ? -1 : 0

    if (vy < 0) return

    for (const tile of this.getAdjacentTiles()) {
      if (tile?.index !== 4 && tile?.index !== 5) continue
      const slopeY = this.getSlope(tile)
      if (!slopeY) continue

      slopeDirection = tile?.index === 4 ? 1 : -1

      if (this.slopeDirection === 0) {
        if (vy > 10 || (speed > 70 && moveDir !== slopeDirection))
          this.rollDirection = slopeDirection

        this.body.velocity.x *= 0.8
      }

      const t = Math.abs(Math.round(slopeY - (SIZE_Y - 1)) - this.y)
      if (t < 3) {
        this.y = Math.round(slopeY - (SIZE_Y - 1))
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
    if (
      !this.body.blocked.down ||
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

    this.body.setVelocityX(this.rollDirection * ROLL_SPEED)

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
  handleLedge = () => {
    const touchingLeft = this.body.blocked.left
    const touchingRight = this.body.blocked.right

    const tile = this.getAdjacentTiles()[0]
    if ((touchingLeft || touchingRight) && tile) {
      if (this.scene.layer.getTileAt(tile.x, tile.y - 1)) return
      const dist = Math.abs(tile.pixelY - this.y)
      if (dist > 4) return
      const lx = this.body.x + (touchingLeft ? -2 : 2)
      const ly = this.body.y + 1
      const direction = touchingLeft ? -1 : 1
      this.hangingLedge = { x: lx, y: ly, direction }
      this.body.setVelocity(0, 0).setAcceleration(0, 0)
      this.setFlipX(direction < 0).play('player-hang', true)
    }
  }

  startPullUp = () => {
    if (!this.hangingLedge || this.isPullingUp) return

    this.isPullingUp = true
    this.play({ key: 'player-pull-up', frameRate: 7 })
    const x = this.hangingLedge!.direction === 1 ? -8 : 8
    this.scene.tweens.add({
      targets: this.scene.cameras.main.followOffset,
      y: SIZE_Y - 2,
      x,
      duration: 820,
      ease: 'Sin.easeIn',
    })
    this.once('animationcomplete', () => {
      this.y -= SIZE_Y / 2
      this.x -= x
      this.scene.cameras.main.setFollowOffset(0, 0)
      this.dropFromHang()
    })
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
    return (
      notCrouched &&
      notHanging &&
      !this.isRolling &&
      !this.onSlope &&
      !this.isLanding
    )
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
