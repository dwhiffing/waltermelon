import { GameScene, tileSize } from '../scenes/Game'

const SPEED = 150
const MAX_SPEED = 100
const JUMP_HEIGHT = 80
const MAX_JUMP_HOLD_TIME = 120
const DRAG = 220
const WALL_SLIDE_DRAG = 500
const WALL_SLIDE_SPEED = 25
const AIR_CONTROL_PERCENT = 0.3
const ROLL_SPEED = 200
const SIZE_X = 5
const SIZE_Y = 20
const OFFSET_X = 14
const OFFSET_Y = 31
const RUN_HOLD_TIME = 1000
const CURSE_START_TIME = 13
const CURSE_CYCLE_END = 20

const STEP_INITIAL_DELAY = 0
const STEP_REPEAT_DELAY = 360

export class Player extends Phaser.Physics.Arcade.Sprite {
  dust: Phaser.GameObjects.Sprite
  declare body: Phaser.Physics.Arcade.Body
  scene: GameScene
  prevInputDirection = 0
  rollDirection = 0
  slopeDirection = 0
  isSkidding = false
  isRunning = false
  isLanding = false
  isCrouching = false
  isExitingCrouch = false
  isStartingCrouch = false
  isPullingUp = false
  isWallSliding = false
  wallDirection = 0
  lastVelocity = 0
  walkHoldStartTime = 0
  hangingLedge: { x: number; y: number; direction: number } | null = null
  tripDirection = 0
  tripCheck = false
  curseTimer = 0
  isBlinking = false
  isJumping = false
  isChargingJump = false
  jumpStartTime = 0
  jumpKeyHeld = false
  stepSoundEvent: Phaser.Time.TimerEvent | null = null
  stepIndex = 0
  lastStepState = ''
  isPlayingStepSounds = false

  constructor(scene: GameScene) {
    const spawn = scene.gameMap.tilemap.findObject(
      'Spawn',
      (o: any) => o.name === 'spawn',
    ) ?? {
      x: 0,
      y: 0,
    }

    super(scene, spawn.x ?? 0, (spawn.y ?? 0) - OFFSET_Y, 'player')
    this.scene = scene

    // const flip = !!getProperty(spawn, 'flip')

    this.scene.physics.add.existing(this)
    this.scene.add.existing(this)
    this.play('player-jump')
      .setBodySize(SIZE_X, SIZE_Y)
      .setOffset(OFFSET_X, OFFSET_Y)

    this.dust = this.scene.add
      .sprite(0, 0, 'dust')
      .play({ key: 'dust-walk', repeat: -1 }, true)

    // this.scene.time.addEvent({
    //   delay: 100,
    //   loop: true,
    //   callback: this.updateCurseTimer,
    // })
  }

  update() {
    this.setDrag(this.targetDragX, this.targetDragY)

    this.setDepth(this.hangingLedge ? -1 : 10)
    this.dust
      .setFlipX(this.flipX)
      .setPosition(this.x + (this.flipX ? 8 : -8), this.y + 4)
      .setVisible(this.isSkidding)

    if (this.hangingLedge) {
      return this.handleHangingOnLedge()
    } else {
      this.detectLedge()
    }

    if (this.canStartWallSlide) this.startWallSlide()
    if (this.isWallSliding) this.handleWallSlide()
    if (this.shouldPlayFallAnim) this.play({ key: 'player-fall' }, true)
    if (this.onGround && !this.onSlope) this.setMaxVelocity(this.maxSpeed, 1000)

    if (this.onGround) {
      if (this.xSpeed <= 1) this.tripCheck = false
      if (this.xSpeed < 5) this.isRunning = false
      if (this.shouldLand) this.startLand()
      if (this.shouldRoll) this.startRoll()
      if (this.shouldStartCrouch) this.startCrouch()
      if (this.shouldEndCrouch) this.endCrouch()
      if (this.shouldStartSkid) this.startSkid()
      if (this.shouldStopSkid) this.endSkid()
      if (this.onSlope) this.handleOnSlope()
      if (this.shouldPlayGroundedAnims) {
        const key =
          this.xSpeed === 0 ? 'idle' : this.isAtMaxSpeed ? 'run' : 'walk'
        const frameRate = this.isAtMaxSpeed ? 12 : this.xSpeed === 0 ? 4 : 8
        this.play({ key: `player-${key}`, frameRate }, true)
      }
    }

    this.handleInput()
    this.handleStep()
    this.handleJump()
    this.detectSlope()
    this.lastVelocity = this.body.velocity.y
  }

  handleInput = () => {
    if (!this.canInput) return

    if (this.moveDirection !== this.inputDirection && this.onGround) {
      this.walkHoldStartTime = this.scene.time.now

      if (this.isSkidding && !this.isTripping && !this.tripCheck) {
        this.tripCheck = true
        if (Math.random() < 0.5) return this.startTrip()
      }
    } else if (this.inputDirection !== 0) {
      const holdDuration = this.scene.time.now - this.walkHoldStartTime
      if (
        holdDuration >= RUN_HOLD_TIME &&
        !this.isRunning &&
        !this.onSlope &&
        this.onGround
      ) {
        this.isRunning = true
      }
    }

    let speed = this.isRunning ? SPEED : SPEED * 0.5
    const l = this.scene.cursors.left.isDown
    const r = this.scene.cursors.right.isDown
    const dir = l ? -1 : r ? 1 : 0
    if (this.onGround && (l || r)) this.setFlipX(l)
    this.body.setAccelerationX(speed * this.controlPercentage * dir)

    if (!(l || r) && !this.onSlope && !this.isRolling)
      this.body.setAccelerationX(0)

    this.scene.time.delayedCall(100, () => (this.prevInputDirection = dir))
  }

  handleStep = () => {
    const state: 'idle' | 'walk' | 'run' =
      this.xSpeed < 1 ||
      !this.onGround ||
      this.onSlope ||
      this.hangingLedge ||
      this.isRolling ||
      this.isSkidding
        ? 'idle'
        : this.isAtMaxSpeed
        ? 'run'
        : 'walk'

    if (state !== this.lastStepState) {
      if (state === 'idle') {
        this.stopStepSounds()
      } else {
        if (state === 'run') this.stopStepSounds()
        this.startStepSounds()
      }
      this.lastStepState = state
    }
  }

  detectSlope() {
    let slopeDirection = 0
    const vy = this.body.velocity.y

    if (vy < 0) return

    for (const tile of this.getAdjacentTiles()) {
      if (tile?.index !== 4 && tile?.index !== 5) continue
      const slopeY = this.getSlope(tile)
      if (!slopeY) continue

      slopeDirection = tile?.index === 4 ? 1 : -1

      // player is entering slope
      if (this.slopeDirection === 0) {
        const startRolling =
          vy > 10 || (this.xSpeed > 70 && this.moveDirection !== slopeDirection)
        if (startRolling) this.rollDirection = slopeDirection

        this.body.velocity.x *= 0.8
      }

      // dont change player position until close enough
      const y = Math.round(slopeY - (SIZE_Y - 1))
      if (Math.abs(y - this.y) < 3) {
        this.y = y
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

  handleOnSlope = () => {
    // force roll when pressing down on slope
    if (!this.isRolling && this.isHoldingDown) {
      this.body.velocity.x *= 0.4
      this.rollDirection = this.slopeDirection
    }
    const isRolling = this.rollDirection !== 0
    const isAgainst = this.moveDirection !== this.slopeDirection
    const dx = isRolling && isAgainst ? -250 : -100
    const maxV = isAgainst ? (isRolling ? 80 : 40) : MAX_SPEED
    this.setFlipX(
      isRolling ? this.moveDirection === -1 : this.slopeDirection < 0,
    )
    this.body.setAccelerationX(this.slopeDirection * dx)
    this.body.setMaxVelocity(maxV, 1000)

    if (isRolling) {
      this.play({ key: 'player-roll', frameRate: 8 }, true)
      this.once('animationcomplete', this.endRoll)
    } else {
      this.play('player-slope-slide', true)
    }
  }

  handleJump = () => {
    if (this.isJumping && this.jumpKeyHeld && this.body.velocity.y < 0) {
      const chargeDuration = this.scene.time.now - this.jumpStartTime
      if (chargeDuration <= MAX_JUMP_HOLD_TIME) {
        const extraVelocity = 4
        this.body.setVelocityY(this.body.velocity.y - extraVelocity)
      }
    }

    if (this.isJumping && this.body.velocity.y >= 0) {
      this.isJumping = false
      this.jumpKeyHeld = false
    }
  }

  startJump = async () => {
    const canNormalJump =
      this.onGround &&
      !this.isRolling &&
      !this.isCrouching &&
      !this.isExitingCrouch
    const canWallJump = this.isWallSliding

    if (!canNormalJump && !canWallJump) return

    this.jumpKeyHeld = true
    this.jumpStartTime = this.scene.time.now

    if (canWallJump) {
      this.doJump(-JUMP_HEIGHT, -this.wallDirection * 60)
      this.setFlipX(this.wallDirection === 1)
      this.isWallSliding = false
      this.wallDirection = 0
      return
    }
    if (this.onSlope) {
      this.doJump(-(JUMP_HEIGHT / 1.5), this.slopeDirection * -25)
      this.slopeDirection = 0
      return
    }

    const { left, right } = this.scene.cursors
    let x =
      left.isDown && this.flipX ? -35 : right.isDown && !this.flipX ? 35 : 0
    if (Math.abs(x) < Math.abs(this.body.velocity.x)) x = this.body.velocity.x
    this.doJump(-JUMP_HEIGHT, x)
  }

  doJump = (velocityY: number, velocityX?: number) => {
    this.scene.sound.play('jump', {
      volume: 0.8,
      rate: 1.1 + Math.random() * 0.2,
    })
    this.play('player-jump')
    if (velocityX) this.body.setVelocityX(velocityX)
    this.body.setVelocityY(velocityY)
    this.isJumping = true
    this.isChargingJump = false
  }

  endJump = () => {
    this.jumpKeyHeld = false
  }

  startStepSounds = () => {
    if (this.isPlayingStepSounds) return

    this.isPlayingStepSounds = true
    this.scene.time.delayedCall(
      STEP_INITIAL_DELAY + (this.isAtMaxSpeed ? 150 : 0),
      () => {
        if (!this.isPlayingStepSounds) return
        this.playStepSound()

        this.stepSoundEvent?.destroy()
        this.stepSoundEvent = this.scene.time.addEvent({
          delay: STEP_REPEAT_DELAY - (this.isAtMaxSpeed ? 70 : 0),
          loop: true,
          callback: this.playStepSound,
        })
      },
    )
  }

  stopStepSounds = () => {
    if (!this.isPlayingStepSounds) return

    this.isPlayingStepSounds = false
    this.stepSoundEvent?.destroy()
    this.stepSoundEvent = null
  }

  playStepSound = () => {
    if (
      !this.isPlayingStepSounds ||
      (!this.scene.cursors.left.isDown && !this.scene.cursors.right.isDown)
    )
      return

    this.scene.sound.play('step', {
      volume: this.isAtMaxSpeed ? 0.9 : 0.8,
      rate: 1 + (this.stepIndex % 2) * 0.3,
    })
    this.stepIndex++
  }

  // crouch/roll
  startRoll = () => {
    if (
      !this.body.blocked.down ||
      this.isRolling ||
      this.isCrouching ||
      this.isExitingCrouch
    )
      return

    this.rollDirection =
      this.prevInputDirection !== 0
        ? this.prevInputDirection
        : this.flipX
        ? -1
        : 1

    this.body.setVelocityX(this.rollDirection * ROLL_SPEED)

    this.play({ key: 'player-roll', frameRate: 10 }).once(
      'animationcomplete',
      this.endRoll,
    )
  }

  endRoll = () => {
    if (this.onSlope) return
    this.rollDirection = 0
    this.play('player-idle')
  }

  startLand = () => {
    this.isRunning = false
    this.walkHoldStartTime = this.scene.time.now

    this.scene.sound.play('land', { volume: 0.4, rate: 1 })

    if (this.lastVelocity < 85) return (this.body.velocity.x *= 0.5)

    this.isLanding = true
    const isFast = this.lastVelocity > 200
    const key = isFast ? 'player-uncrouch' : 'player-land'
    this.play({ key, frameRate: 5 }, true).once(
      'animationcomplete',
      () => (this.isLanding = false),
    )
    this.body.velocity.x *= isFast ? 0 : 0.3
    this.body.setAccelerationX(0)
  }

  startCrouch = () => {
    this.isCrouching = true
    this.isStartingCrouch = true
    this.play({ key: 'player-crouch', frameRate: 8 }, true)
    this.setVelocityX(0).setAccelerationX(0)
    this.once('animationcomplete', () => (this.isStartingCrouch = false))
  }

  endCrouch = () => {
    this.isExitingCrouch = true
    this.play({ key: 'player-uncrouch' }, true)
    this.once('animationcomplete', () => {
      this.isCrouching = false
      this.isExitingCrouch = false
      this.play('player-idle', true)
    })
  }

  startSkid = () => {
    this.isSkidding = true
    this.play('player-skid', true)
  }

  endSkid = () => {
    this.isSkidding = false
  }

  startTrip = () => {
    // if (this.isTripping || !this.onGround) return
    // this.tripDirection = this.body.velocity.x > 0 ? -1 : 1
    // this.body.setVelocity(this.tripDirection * 120, -80)
    // this.play({ key: 'player-skid', frameRate: 10 }, true)
    // this.setFlipX(this.tripDirection === 1)
    // this.scene.time.delayedCall(500, () => (this.tripDirection = 0))
  }

  // ledges
  detectLedge = () => {
    if (!this.onGround && this.body.velocity.y > 150) return

    const tile = this.getAdjacentTiles()[0]
    if (!tile) return
    // return if there is a tile directly above this tile
    if (this.scene.gameMap.layer.getTileAt(tile.x, tile.y - 1)) return

    const distX = Math.abs(tile.pixelX - this.x) - (this.flipX ? 19 : 0)
    const distY = Math.abs(tile.pixelY - this.y)
    if (distY > 3 || distX > 4) return

    const playerFacingDirection = this.flipX ? -1 : 1
    const direction = tile.index === 3 ? -1 : 1
    if (
      this.inputDirection !== direction ||
      playerFacingDirection !== direction
    )
      return

    const isLeft = tile.index === 3
    const lx = tile.pixelX + (isLeft ? 14 : -4)
    const ly = this.body.y + 1
    this.hangingLedge = { x: lx, y: ly, direction }
    this.body.setVelocity(0, 0).setAcceleration(0, 0)
    this.setFlipX(direction < 0).play('player-hang', true)
  }

  handleHangingOnLedge = () => {
    if (!this.hangingLedge) return
    this.body.setVelocity(0, 0).setAcceleration(0, 0)

    this.body.x = this.hangingLedge.x
    this.body.y = this.hangingLedge.y
    if (!this.isPullingUp) {
      const c = this.scene.cursors
      const l = this.hangingLedge.direction === 1
      const toward = l ? c.right.isDown : c.left.isDown
      const away = l ? c.left.isDown : c.right.isDown

      if (toward || this.scene.zKey.isDown) this.startPullUp()
      if (away || this.isHoldingDown) this.dropFromHang()
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

  startWallSlide = () => {
    this.isWallSliding = true
    this.wallDirection = this.touchingWallDirection
    this.play({ key: 'player-wallslide', repeat: -1 }, true).setFlipX(
      this.wallDirection === -1,
    )
  }

  handleWallSlide = () => {
    if (this.body.velocity.y < WALL_SLIDE_SPEED)
      this.body.velocity.y = WALL_SLIDE_SPEED
    if (this.shouldExitWallSlide) {
      this.play({ key: 'player-fall' }, true)
      this.isWallSliding = false
      this.wallDirection = 0
    }
  }

  getAdjacentTiles() {
    const body = this.body
    const centerTileX = Math.floor((body.x + body.width / 2) / tileSize)
    const bottomTileY = Math.floor((body.y + body.height - 2) / tileSize)

    let tiles = []

    for (let x = centerTileX - 1; x <= centerTileX + 1; x++) {
      for (let y = bottomTileY; y <= bottomTileY + 1; y++) {
        const tile = this.scene.gameMap.layer.getTileAt(x, y)
        if (tile) tiles.push(tile)
      }
    }
    return tiles
  }

  updateCurseTimer = () => {
    this.curseTimer = (this.curseTimer + 1) % (CURSE_CYCLE_END * 10)

    const secs = this.curseTimer / 10
    const shouldBlink =
      (secs >= CURSE_START_TIME - 1 && secs < CURSE_START_TIME) ||
      (secs >= CURSE_CYCLE_END - 1 && secs < CURSE_CYCLE_END)

    if (shouldBlink) this.startBlinking()
    if (!shouldBlink) this.stopBlinking()
    if (!this.isBlinking) this.updateColorState()
  }

  startBlinking = () => {
    if (this.isBlinking) return

    this.isBlinking = true
    let blinkState = true
    this.scene.time.addEvent({
      delay: 100,
      repeat: 10,
      callback: () => {
        blinkState = !blinkState
        this.updateColorState(blinkState)
      },
    })
  }

  stopBlinking = () => {
    this.isBlinking = false
    this.updateColorState()
  }

  updateColorState(isCursed = this.isCursed) {
    if (isCursed) {
      this.scene.dynamicTextureManager.swapColor(
        { r: 252, g: 222, b: 234 },
        { r: 255, g: 77, b: 109 },
      )
    } else {
      this.scene.dynamicTextureManager.reset()
    }
  }

  get isCursed() {
    const secs = this.curseTimer / 10
    return secs >= CURSE_START_TIME && secs < CURSE_CYCLE_END
  }

  get canStartWallSlide() {
    return (
      !this.isWallSliding &&
      this.isTouchingWall &&
      !this.onGround &&
      !this.hangingLedge &&
      this.body.velocity.y > 0
    )
  }

  get shouldExitWallSlide() {
    return (
      this.onGround ||
      !this.isTouchingWall ||
      this.hangingLedge ||
      (this.inputDirection !== 0 && this.inputDirection !== this.wallDirection)
    )
  }

  get isTouchingWall() {
    return this.touchingWallDirection !== 0
  }

  get touchingWallDirection() {
    if (this.body.blocked.left) return -1
    if (this.body.blocked.right) return 1
    return 0
  }

  get onGround() {
    return this.body.blocked.down || this.onSlope
  }

  get isTripping() {
    return this.tripDirection !== 0
  }

  get isRolling() {
    return this.rollDirection !== 0
  }

  get shouldRoll() {
    return this.isHoldingDown && this.isAtMaxSpeed && this.xSpeed > 80
  }

  get shouldStartSkid() {
    return (
      !this.isSkidding &&
      !this.isRolling &&
      this.isRunning &&
      this.isChangingDirection
    )
  }

  get shouldStopSkid() {
    return (
      this.isSkidding &&
      (this.inputDirection === this.moveDirection || this.xSpeed < 5)
    )
  }

  get shouldStartCrouch() {
    return (
      this.isHoldingDown &&
      !this.isCrouching &&
      !this.isExitingCrouch &&
      this.xSpeed < 5
    )
  }

  get shouldEndCrouch() {
    return (
      !this.isHoldingDown &&
      !this.isStartingCrouch &&
      !this.isExitingCrouch &&
      this.isCrouching &&
      this.xSpeed < 5
    )
  }

  get onSlope() {
    return this.slopeDirection !== 0
  }

  get shouldLand() {
    return this.anims.currentAnim?.key === 'player-fall'
  }

  get shouldPlayFallAnim() {
    return (
      !this.onSlope &&
      !this.isRolling &&
      !this.hangingLedge &&
      !this.isWallSliding &&
      this.body.velocity.y > 5 &&
      this.anims.currentAnim?.key !== 'player-fall'
    )
  }

  get shouldPlayGroundedAnims() {
    return (
      !this.isSkidding &&
      !this.isCrouching &&
      !this.isExitingCrouch &&
      !this.isRolling &&
      !this.isLanding &&
      this.anims.currentAnim?.key !== 'player-jump-start' &&
      this.anims.currentAnim?.key !== 'player-look' &&
      !this.onSlope
    )
  }

  get maxSpeed() {
    return this.isRunning ? MAX_SPEED : MAX_SPEED * 0.65
  }

  get targetDragX() {
    if (!this.onGround || this.isRolling || this.isTripping) return 0
    if (this.onSlope) return 9

    return this.isRunning ? DRAG : DRAG * 2
  }

  get isAtMaxSpeed() {
    return this.isRunning && this.xSpeed >= MAX_SPEED * 0.9
  }

  get targetDragY() {
    if (this.onSlope) return 9
    return this.isWallSliding ? WALL_SLIDE_DRAG : 0
  }

  get xSpeed() {
    return Math.abs(this.body.velocity.x)
  }

  get moveDirection() {
    const vx = this.body.velocity.x
    return vx > 5 ? 1 : vx < -5 ? -1 : 0
  }

  get canInput() {
    const notCrouched = !this.isCrouching && !this.isExitingCrouch
    const notHanging = !this.hangingLedge && !this.isPullingUp
    return (
      (notCrouched &&
        notHanging &&
        !this.isTripping &&
        !this.isRolling &&
        !this.onSlope &&
        !this.isLanding) ||
      this.isWallSliding
    )
  }

  get isHoldingDown() {
    return this.scene.cursors.down.isDown
  }

  get controlPercentage() {
    return this.isChangingDirection
      ? 0
      : this.onGround
      ? 1
      : AIR_CONTROL_PERCENT
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
      this.prevInputDirection !== 0 &&
      this.inputDirection !== this.prevInputDirection
    )
  }
}

// const getProperty = (o: any, k: string) =>
//   o.properties.find((p: any) => p.name === k)
