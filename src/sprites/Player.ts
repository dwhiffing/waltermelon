import { GameScene, tileSize } from '../scenes/Game'
import { MovingTile } from './MovingTile'
import { MOVE } from '../movement'

const WALL_SLIDE_DRAG = 500
const WALL_SLIDE_SPEED = 25
const HORIZONTAL_COYOTE_TIME = 150
const SIZE_X = 5
const SIZE_Y = 20
const OFFSET_X = 14
const OFFSET_Y = 31

const STEP_INITIAL_DELAY = 0
const STEP_REPEAT_DELAY = 360

const DUST_WALK_PARTICLE: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
  {
    speedY: { min: -8, max: -10 },
    speedX: { min: -8, max: 8 },
    frame: [3],
    lifespan: { max: 2000, min: 200 },
    scale: 0.5,
  }

const DUST_LAND_PARTICLE: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
  {
    speedY: { min: -1, max: -5 },
    speedX: { min: -30, max: 30 },
    frame: [3],
    lifespan: { max: 800, min: 100 },
    scale: 0.5,
  }

const DUST_SLIDE_PARTICLE: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
  {
    speedY: { min: -8, max: -20 },
    speedX: { min: -4, max: 4 },
    frame: [3],
    lifespan: { max: 1500, min: 200 },
    scale: 0.5,
  }

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body
  scene: GameScene
  prevInputDirection = 0
  rollDirection = 0
  slopeDirection = 0
  isSkidding = false
  isLanding = false
  isCrouching = false
  isExitingCrouch = false
  isStartingCrouch = false
  isPullingUp = false
  isWallSliding = false
  wallDirection = 0
  lastVelocity = 0
  tripDirection = 0
  isJumping = false
  isChargingJump = false
  jumpStartTime = 0
  jumpKeyHeld = false
  horizontalCoyoteStartTime = 0
  lastHorizontalInput = 0
  leftGroundTime = 0
  directionChangeTime = 0
  jumpPressedTime = 0
  wasOnGroundLastFrame = false
  stepSoundEvent: Phaser.Time.TimerEvent | null = null
  stepIndex = 0
  lastStepState = ''
  isPlayingStepSounds = false
  slideSoundObject: Phaser.Sound.BaseSound | null = null
  isPlayingSlideSounds = false
  movingTile: MovingTile | null = null
  lastSkidTime = 0
  lastWallSlideExitTime = 0
  hangingLedge: {
    x: number
    y: number
    direction: number
    tileX: number
    tileY: number
  } | null = null

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

    this.scene.physics.add.existing(this)
    this.scene.add.existing(this)
    this.play('player-jump')
      .setBodySize(SIZE_X, SIZE_Y)
      .setOffset(OFFSET_X, OFFSET_Y)

    this.wasOnGroundLastFrame = true
  }

  update() {
    this.setDrag(this.targetDragX, this.targetDragY)

    const currentlyOnGround = this.onGround
    if (this.wasOnGroundLastFrame && !currentlyOnGround && !this.isJumping) {
      this.leftGroundTime = this.scene.time.now
      if (this.xSpeed < 0) this.detectLedgeGrab()
    } else if (!this.wasOnGroundLastFrame && currentlyOnGround) {
      this.leftGroundTime = 0
    }
    this.wasOnGroundLastFrame = currentlyOnGround

    this.setDepth(this.hangingLedge ? -1 : 10)

    if (this.hangingLedge) {
      this.stopStepSounds()
      return this.handleHangingOnLedge()
    } else {
      this.detectLedge()
    }

    if (this.canStartWallSlide) this.startWallSlide()
    if (this.isWallSliding) this.handleWallSlide()
    if (this.shouldPlayFallAnim) this.play({ key: 'player-fall' }, true)
    if (this.onGround && !this.onSlope)
      this.setMaxVelocity(this.maxSpeed, MOVE.maxFallSpeed)

    if (this.onGround) {
      if (this.shouldLand) this.startLand()
      if (this.shouldRoll) this.startRoll()
      if (this.shouldStartCrouch) this.startCrouch()
      if (this.shouldEndCrouch) this.endCrouch()
      if (this.shouldStartSkid) this.startSkid()
      if (this.shouldStopSkid) this.endSkid()
      if (this.onSlope) this.handleOnSlope()
      if (this.shouldPlayGroundedAnims) {
        const key = this.xSpeed === 0 ? 'idle' : this.isRunning ? 'run' : 'walk'
        const frameRate = this.isRunning ? 12 : this.xSpeed === 0 ? 4 : 8
        this.play({ key: `player-${key}`, frameRate }, true)
      }
    }

    this.handleInput()
    this.handleStep()
    this.handleJumpBuffer()
    this.handleJump()
    this.handleFallGravity()
    this.detectSlope()
    this.lastVelocity = this.body.velocity.y

    if (this.isSkidding) {
      if (!this.onGround) this.endSkid()
      if (Phaser.Math.RND.between(0, 2) === 0)
        this.scene.dustParticles
          .setConfig(DUST_SLIDE_PARTICLE)
          .explode(1, this.body.x + (this.flipX ? 7 : -3), this.body.y + 18)
      if (Phaser.Math.RND.between(0, 3) === 0)
        this.scene.dustParticles2
          .setConfig(DUST_SLIDE_PARTICLE)
          .explode(1, this.body.x + (this.flipX ? 7 : -3), this.body.y + 18)
    }
  }

  handleInput = () => {
    if (!this.canInput) return

    const dir = this.inputDirection
    const now = this.scene.time.now

    if (dir !== 0 && this.prevInputDirection !== 0 && dir !== this.prevInputDirection)
      this.directionChangeTime = now
    this.prevInputDirection = dir

    if (this.onGround && dir !== 0) this.setFlipX(dir === -1)

    const isInHorizontalCoyoteTime =
      this.isJumping &&
      this.horizontalCoyoteStartTime > 0 &&
      now - this.horizontalCoyoteStartTime < HORIZONTAL_COYOTE_TIME

    const justStartedPressingDirection =
      dir !== 0 && this.lastHorizontalInput === 0 && isInHorizontalCoyoteTime

    this.lastHorizontalInput = dir

    // velocity is driven directly here, so physics drag/acceleration stay off
    this.body.setAccelerationX(0).setDragX(0)

    if (justStartedPressingDirection) {
      const vx = dir * Math.max(MOVE.standingJumpVX, this.xSpeed)
      this.body.setVelocityX(vx)
      this.setFlipX(dir === -1)
      this.horizontalCoyoteStartTime = 0
      return
    }

    const vx = this.body.velocity.x
    const ground = this.onGround
    const target = dir * this.maxSpeed
    let rate: number

    if (dir === 0) {
      rate = ground
        ? MOVE.groundDecel * (this.isRunning ? 1 : 2)
        : MOVE.airDecel
    } else if (vx !== 0 && Math.sign(vx) !== dir) {
      rate = (ground ? MOVE.turnAccel : MOVE.airAccel) * this.controlPercentage
    } else if (Math.abs(vx) > this.maxSpeed) {
      // carried momentum (rolls, slope launches) bleeds off instead of snapping
      rate = ground ? MOVE.groundDecel : MOVE.airDecel
    } else {
      const taper = 1 - (Math.abs(vx) / this.maxSpeed) * MOVE.accelTaper
      rate =
        (ground ? MOVE.groundAccel : MOVE.airAccel) *
        taper *
        this.controlPercentage
    }

    const step = rate * (this.scene.game.loop.delta / 1000)
    const next =
      vx < target ? Math.min(vx + step, target) : Math.max(vx - step, target)
    this.body.setVelocityX(next)
  }

  handleStep = () => {
    if ((this.onSlope || this.isWallSliding) && !this.isPlayingSlideSounds) {
      this.isPlayingSlideSounds = true
      this.slideSoundObject = this.scene.sound.add('slide', {
        volume: 0.15,
        rate: this.onSlope ? 0.5 : 1,
        loop: true,
      })
      this.scene.time.delayedCall(this.onSlope ? 0 : 120, () =>
        this.slideSoundObject?.play(),
      )
    }

    if (!(this.isWallSliding || this.onSlope) && this.isPlayingSlideSounds) {
      this.slideSoundObject?.destroy()
      this.slideSoundObject = null
      this.isPlayingSlideSounds = false
    }

    const state: 'idle' | 'walk' | 'run' =
      this.xSpeed < 1 ||
      !this.onGround ||
      this.onSlope ||
      this.hangingLedge ||
      this.isRolling ||
      this.isSkidding
        ? 'idle'
        : this.isRunning
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
    if (px < tx - 1 || px > tx + tileSize + 1) return null

    const approachingFromTop =
      this.onGround && this.slopeDirection === 0 && this.body.velocity.y >= 0

    if (approachingFromTop) {
      const tx = tile.x * tileSize
      const px = this.body.x + this.body.width / 2 + 1
      const slopeDirection = tile?.index === 4 ? 1 : -1
      const relX = (px - tx) / tileSize
      const x = slopeDirection === 1 ? relX : 1 - relX

      if (x > 0.9) return null
    }

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
    const maxV = isAgainst ? (isRolling ? 80 : 40) : this.maxSpeed
    this.setFlipX(
      isRolling ? this.moveDirection === -1 : this.slopeDirection < 0,
    )
    this.body.setAccelerationX(this.slopeDirection * dx)
    this.body.setMaxVelocity(maxV, MOVE.maxFallSpeed)

    if (isRolling) {
      if (this.anims.currentAnim?.key !== 'player-roll')
        this.scene.sound.play('roll', { volume: 0.2 })

      this.play({ key: 'player-roll', frameRate: 8 }, true)
      this.once('animationcomplete', this.endRoll)
    } else {
      this.play('player-slope-slide', true)
    }
    if (Phaser.Math.RND.between(0, 3) === 0)
      this.scene.dustParticles
        .setConfig(DUST_SLIDE_PARTICLE)
        .explode(1, this.body.x, this.body.y + 18)
  }

  handleJump = () => {
    if (this.isJumping && this.jumpKeyHeld && this.body.velocity.y < 0) {
      const chargeDuration = this.scene.time.now - this.jumpStartTime
      if (chargeDuration <= MOVE.jumpHoldMs) {
        const deltaTime = this.scene.game.loop.delta / 1000
        const extraVelocity = MOVE.jumpHoldBoost * deltaTime
        this.body.setVelocityY(this.body.velocity.y - extraVelocity)
      }
    }

    if (this.isJumping && this.body.velocity.y >= 0) {
      this.isJumping = false
      this.jumpKeyHeld = false
      this.horizontalCoyoteStartTime = 0 // Reset coyote time when jump ends
    }
  }

  handleJumpBuffer = () => {
    if (!this.jumpPressedTime || !this.scene.zKey.isDown) return
    if (this.scene.time.now - this.jumpPressedTime > MOVE.jumpBufferMs) return
    this.tryJump()
  }

  handleFallGravity = () => {
    const falling =
      this.body.velocity.y > 0 &&
      !this.isWallSliding &&
      !this.onSlope &&
      !this.hangingLedge
    const gravity = this.scene.physics.world.gravity.y
    this.body.setGravityY(falling ? (MOVE.fallGravityMult - 1) * gravity : 0)
  }

  startJump = () => {
    this.jumpPressedTime = this.scene.time.now
    this.tryJump()
  }

  tryJump = () => {
    const canNormalJump =
      this.onGround &&
      !this.isRolling &&
      !this.isCrouching &&
      !this.isExitingCrouch
    const canWallJump = this.isWallSliding
    const canCoyoteJump =
      this.isInCoyoteTime &&
      !this.isRolling &&
      !this.isCrouching &&
      !this.isExitingCrouch

    if (!canNormalJump && !canWallJump && !canCoyoteJump) return

    this.jumpPressedTime = 0
    this.jumpKeyHeld = true
    this.jumpStartTime = this.scene.time.now
    this.horizontalCoyoteStartTime = this.scene.time.now
    this.lastHorizontalInput = this.inputDirection

    this.leftGroundTime = 0

    if (canWallJump) {
      this.doJump(MOVE.jumpVelocity * -0.8, -this.wallDirection * 68)
      this.setFlipX(this.wallDirection === 1)
      this.isWallSliding = false
      this.wallDirection = 0
      return
    }
    if (this.onSlope) {
      this.setMaxVelocity(this.maxSpeed, MOVE.maxFallSpeed)
      this.doJump(MOVE.jumpVelocity * -1, this.slopeDirection * -65)
      this.slopeDirection = 0
      return
    }

    const { left, right } = this.scene.cursors
    const vx = MOVE.standingJumpVX
    let x =
      left.isDown && this.flipX ? -vx : right.isDown && !this.flipX ? vx : 0
    if (Math.abs(x) < Math.abs(this.body.velocity.x)) x = this.body.velocity.x
    this.doJump(-MOVE.jumpVelocity, x)
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
    if (this.isJumping && this.body.velocity.y < 0)
      this.body.setVelocityY(this.body.velocity.y * MOVE.jumpCut)
  }

  startStepSounds = () => {
    if (this.isPlayingStepSounds) return

    this.isPlayingStepSounds = true
    this.scene.time.delayedCall(
      STEP_INITIAL_DELAY + (this.isRunning ? 150 : 0),
      () => {
        if (!this.isPlayingStepSounds) return
        this.playStepSound()

        this.stepSoundEvent?.destroy()
        this.stepSoundEvent = this.scene.time.addEvent({
          delay: STEP_REPEAT_DELAY - (this.isRunning ? 70 : 0),
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
    if (!this.isPlayingStepSounds) return

    this.scene.sound.play('step', {
      volume: this.isRunning ? 0.9 : 0.8,
      rate: 1 + (this.stepIndex % 2) * 0.3,
    })
    this.scene.dustParticles
      .setConfig(DUST_WALK_PARTICLE)
      .explode(2, this.body.x, this.body.y + 18)
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

    this.body.setVelocityX(this.rollDirection * MOVE.rollSpeed)

    this.scene.sound.play('roll', { volume: 0.2 })
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
    this.scene.sound.play('land', { volume: 0.4, rate: 1 })

    this.scene.dustParticles
      .setConfig(DUST_LAND_PARTICLE)
      .explode(this.lastVelocity * 0.05, this.body.x, this.body.y + 20)

    this.scene.dustParticles2
      .setConfig(DUST_LAND_PARTICLE)
      .explode(this.lastVelocity * 0.05, this.body.x, this.body.y + 20)

    this.horizontalCoyoteStartTime = 0
    this.leftGroundTime = 0

    if (this.lastVelocity < MOVE.landLockFallSpeed)
      return (this.body.velocity.x *= MOVE.softLandKeep)

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
    if (this.isSkidding) return
    this.isSkidding = true
    this.lastSkidTime = this.scene.time.now
    this.scene.sound.play('skid', { volume: 0.1, rate: 1.6 })
    this.play('player-skid', true)
  }

  endSkid = () => {
    this.isSkidding = false
  }

  // ledges
  detectLedgeGrab = () => {
    const direction =
      this.moveDirection === 0 ? 0 : this.moveDirection > 0 ? -1 : 1
    if (direction === 0) return

    const tile = this.getAdjacentTiles()[0]
    if (this.isValidLedge(tile)) this.grabLedge(tile)
  }

  isValidLedge = (tile?: Phaser.Tilemaps.Tile) => {
    if (
      !tile ||
      this.scene.gameMap.layer.getTileAt(tile.x, tile.y - 1) ||
      (tile.index !== 3 &&
        tile.index !== 1 &&
        tile.index !== 45 &&
        tile.index !== 33 &&
        tile.index !== 34 &&
        tile.index !== 31 &&
        tile.index !== 35)
    )
      return false
    return true
  }

  detectLedge = () => {
    if (!this.onGround && this.body.velocity.y > 250) return

    const tiles = this.getAdjacentTiles()
    for (let tile of tiles) {
      if (!this.isValidLedge(tile)) continue

      const distX = Math.abs(tile.pixelX - this.x) - (this.flipX ? 19 : 0)
      const distY = Math.abs(tile.pixelY - this.y)
      const acceptableDistY = this.isWallSliding ? 12 : 4
      if (distY > acceptableDistY || distX > 4) continue

      const playerFacingDirection = this.flipX ? -1 : 1
      const isLeft = tile.pixelX - this.x < 0
      const direction = isLeft ? -1 : 1
      if (playerFacingDirection !== direction) continue

      this.grabLedge(tile)
      break
    }
  }

  grabLedge = (tile: Phaser.Tilemaps.Tile) => {
    const isLeft = tile.pixelX - this.x < 0
    const direction = isLeft ? -1 : 1
    const lx = tile.pixelX + (isLeft ? 14 : -4)
    const ly = tile.pixelY - 2
    this.scene.sound.play('grab', { volume: 0.3, rate: 0.5 })
    this.hangingLedge = {
      x: lx,
      y: ly,
      direction,
      tileX: tile.x,
      tileY: tile.y,
    }
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

      if (toward || this.scene.zKey.isDown) this.startPullUp()
      if (this.isHoldingDown) this.dropFromHang()
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
    this.rollDirection = 0
    this.wallDirection = this.touchingWallDirection
    this.play({ key: 'player-wallslide', repeat: -1 }, true).setFlipX(
      this.wallDirection === -1,
    )
  }

  handleWallSlide = () => {
    if (this.body.velocity.y < WALL_SLIDE_SPEED)
      this.body.velocity.y = WALL_SLIDE_SPEED

    if (Phaser.Math.RND.between(0, 5) === 0)
      this.scene.dustParticles
        .setConfig(DUST_SLIDE_PARTICLE)
        .explode(1, this.body.x + (this.flipX ? -5 : 7), this.body.y + 2)
    if (this.shouldExitWallSlide) {
      this.isWallSliding = false
      this.wallDirection = 0
      this.lastWallSlideExitTime = this.scene.time.now
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

  get canStartWallSlide() {
    const wallSlideGracePeriod = 500 // Half second grace period
    const timeSinceLastExit = this.scene.time.now - this.lastWallSlideExitTime
    const graceExpired = timeSinceLastExit >= wallSlideGracePeriod

    return (
      !this.isWallSliding &&
      this.isTouchingWall &&
      !this.onGround &&
      !this.hangingLedge &&
      this.body.velocity.y > 0 &&
      graceExpired
    )
  }

  get shouldExitWallSlide() {
    return (
      this.onGround ||
      !this.isTouchingWall ||
      this.hangingLedge ||
      (this.inputDirection !== 0 && this.inputDirection === -this.wallDirection)
    )
  }

  get isTouchingWall() {
    return this.touchingWallDirection !== 0
  }

  get touchingWallDirection() {
    const body = this.body
    const tileSize = this.scene.gameMap.tilemap.tileWidth

    const leftTileX = Math.floor((body.x - 1) / tileSize)
    const rightTileX = Math.floor((body.x + body.width + 1) / tileSize)
    const midTileY = Math.floor((body.y + body.height / 2) / tileSize)

    const leftTile = this.scene.gameMap.layer.getTileAt(leftTileX, midTileY)
    if (leftTile && leftTile.collides) {
      const leftWallEdge = (leftTileX + 1) * tileSize
      if (body.x - leftWallEdge <= 1) return -1
    }

    const rightTile = this.scene.gameMap.layer.getTileAt(rightTileX, midTileY)
    if (rightTile && rightTile.collides) {
      const rightWallEdge = rightTileX * tileSize
      if (rightWallEdge - (body.x + body.width) <= 1) return 1
    }

    if (this.body.blocked.left) return -1
    if (this.body.blocked.right) return 1
    return 0
  }

  get onGround() {
    return this.body.blocked.down || this.onSlope
  }

  get isInCoyoteTime() {
    return (
      this.leftGroundTime > 0 &&
      this.scene.time.now - this.leftGroundTime < MOVE.coyoteMs
    )
  }

  get isTripping() {
    return this.tripDirection !== 0
  }

  get isRolling() {
    return this.rollDirection !== 0
  }

  get shouldRoll() {
    return this.isHoldingDown && this.isRunning && this.xSpeed > 80
  }

  get shouldStartSkid() {
    const timeSinceLastSkid = this.scene.time.now - this.lastSkidTime
    const skidCooldownExpired = timeSinceLastSkid >= 500

    return (
      !this.isSkidding &&
      !this.isRolling &&
      this.isRunning &&
      this.xSpeed > 70 &&
      this.inputDirection === -this.moveDirection &&
      skidCooldownExpired
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

  get isRunning() {
    return this.xSpeed >= this.maxSpeed * 0.6
  }

  get maxSpeed() {
    return MOVE.maxSpeed
  }

  get targetDragX() {
    if (!this.onGround || this.isRolling || this.isTripping) return 0
    if (this.onSlope) return 9

    return this.isRunning ? MOVE.groundDecel : MOVE.groundDecel * 2
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
    return this.isChangingDirection ? 0 : 1
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
      this.scene.time.now - this.directionChangeTime < MOVE.turnLockMs
    )
  }
}

// const getProperty = (o: any, k: string) =>
//   o.properties.find((p: any) => p.name === k)
