import { GameScene, tileSize } from '../scenes/Game'
import { MovingTile } from './MovingTile'

const TILE_CRACK_DELAY = 100 // Start crack animation 1.5s after stepping
const TILE_REMOVE_DELAY = 2200 // Remove tile 2s after stepping
const TILE_RESTORE_DELAY = 2200 // Restore tile 3.4s after stepping
const TILE_GROWTH_DELAY = 100 // Start growth animation 1.5s before restoration
const CRUMBLING_TILES = [45] // Tiles that crumble when stepped on
const COLLISION_TILES = [
  1, 2, 3, 9, 10, 11, 16, 17, 18, 19, 20, 21, 23, 28, 29, 31, 32, 33, 34, 35,
  39, 45, 49, 50, 51, 55, 57, 58, 59,
]

export class GameMap {
  scene: GameScene
  map: Phaser.Tilemaps.Tilemap
  coins: Phaser.Physics.Arcade.Group
  layer: Phaser.Tilemaps.TilemapLayer
  overlay: Phaser.Tilemaps.TilemapLayer
  movingTiles: MovingTile[] = []
  steppedOnTiles: Set<string> = new Set()
  tilesToRemove: Map<string, { removeTime: number; crackStartTime: number }> =
    new Map()
  tilesToRestore: Map<
    string,
    {
      restoreTime: number
      growthStartTime: number
      originalTile: { index: number; x: number; y: number }
    }
  > = new Map()
  growthSprites: Map<string, Phaser.GameObjects.Sprite> = new Map()
  crackSprites: Map<string, Phaser.GameObjects.Sprite> = new Map()
  bgGraphics: Phaser.GameObjects.TileSprite
  debugGraphics: Phaser.GameObjects.Graphics
  overlayAlphaTween: Phaser.Tweens.Tween | null = null
  isOverlappingOverlay = false

  constructor(scene: GameScene) {
    this.scene = scene
    this.loadMap()
    this.debugGraphics = this.scene.add.graphics()

    this.bgGraphics = this.scene.add
      .tileSprite(
        16,
        16,
        this.map.widthInPixels - 32,
        this.map.heightInPixels - 32,
        'bg',
      )
      .setOrigin(0)
      .setDepth(-1)
  }

  loadMap() {
    this.map = this.scene.make.tilemap({
      key: 'map',
      tileWidth: 32,
      tileHeight: 32,
    })
    const tileset = this.map.addTilesetImage('tiles')!
    this.layer = this.map.createLayer('Level', tileset)!
    this.map.setCollision(COLLISION_TILES)
    this.overlay = this.map
      .createLayer('Overlay', tileset)!
      .setDepth(1000)
      .setAlpha(1)

    const platformsLayer = this.map.getObjectLayer('Platforms')
    if (!platformsLayer) return

    platformsLayer.objects.forEach((obj: any) => {
      if (!obj.gid) return
      const get = (k: string) =>
        obj.properties?.find((p: any) => p.name === k)?.value ?? 0

      const movingTile = new MovingTile(this.scene, {
        ...obj,
        targetX: get('targetX'),
        targetY: get('targetY'),
      })
      this.movingTiles.push(movingTile)
    })
  }

  update() {
    this.processTileRemovals()
    this.processTileRestorations()
    this.movingTiles.forEach((tile) => tile.update())
    if (this.scene.physics.config.debug) this.drawTilePhysicsBodies()
    if (this.scene.player.onGround)
      this.checkPlayerSteppedOnTile(this.scene.player.body)

    const currentlyOverlapping = this.checkOverlayTileOverlap()
    if (currentlyOverlapping !== this.isOverlappingOverlay) {
      this.isOverlappingOverlay = currentlyOverlapping
      this.tweenOverlayAlpha(currentlyOverlapping ? 0.5 : 1.0)
    }
  }

  loadCoins() {
    this.coins = this.scene.physics.add.group()
    this.map.getObjectLayer('Coins')!.objects.forEach(({ x, y }: any) => {
      const coin = this.scene.physics.add
        .sprite(x!, y! - 2, 'coin')
        .setOrigin(0, 1)
        .setBodySize(10, 10)
      this.coins.add(coin)
      this.scene.tweens.add({
        targets: coin,
        y: y! - 4,
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
      coin.body.setAllowGravity(false)
    })
  }

  checkPlayerSteppedOnTile(playerBody: Phaser.Physics.Arcade.Body): boolean {
    const centerX = playerBody.x + playerBody.width / 2
    const bottomY = playerBody.y + playerBody.height
    const tileX = Math.floor(centerX / tileSize)
    const tileY = Math.floor(bottomY / tileSize)
    const tile = this.layer.getTileAt(tileX, tileY)

    if (!tile?.collides) return false

    // Only process tiles that are configured to crumble
    if (!CRUMBLING_TILES.includes(tile.index)) return false

    const tileKey = `${tileX},${tileY}`
    if (this.steppedOnTiles.has(tileKey)) return false

    this.steppedOnTiles.add(tileKey)
    this.tilesToRemove.set(tileKey, {
      removeTime: this.scene.time.now + TILE_REMOVE_DELAY,
      crackStartTime: this.scene.time.now + TILE_CRACK_DELAY,
    })

    return true
  }

  getTileWorldPosition(tileKey: string) {
    const [x, y] = tileKey.split(',').map(Number)
    return { x: x * tileSize, y: y * tileSize, tileX: x, tileY: y }
  }

  createTileSprite(
    tileKey: string,
    spriteKey: string,
    spriteMap: Map<string, Phaser.GameObjects.Sprite>,
  ) {
    if (spriteMap.has(tileKey)) return spriteMap.get(tileKey)!

    const { x, y } = this.getTileWorldPosition(tileKey)
    const sprite = this.scene.add
      .sprite(x, y, spriteKey)
      .setOrigin(0, 0)
      .setDepth(5)
      .play({ key: spriteKey, frameRate: 4 })

    spriteMap.set(tileKey, sprite)
    return sprite
  }

  destroyTileSprite(
    tileKey: string,
    spriteMap: Map<string, Phaser.GameObjects.Sprite>,
  ) {
    const sprite = spriteMap.get(tileKey)
    if (sprite) {
      sprite.destroy()
      spriteMap.delete(tileKey)
    }
  }

  processTileRemovals() {
    const currentTime = this.scene.time.now

    for (const [tileKey, { removeTime, crackStartTime }] of this
      .tilesToRemove) {
      if (currentTime >= crackStartTime && !this.crackSprites.has(tileKey)) {
        this.createTileSprite(tileKey, 'crack', this.crackSprites)
      }

      if (currentTime >= removeTime) {
        const { tileX, tileY } = this.getTileWorldPosition(tileKey)
        const tile = this.layer.getTileAt(tileX, tileY)

        if (tile) {
          const originalTile = { index: tile.index, x: tile.x, y: tile.y }
          this.layer.removeTileAt(tileX, tileY)
          this.destroyTileSprite(tileKey, this.crackSprites)

          this.tilesToRestore.set(tileKey, {
            restoreTime: currentTime + TILE_RESTORE_DELAY,
            growthStartTime: currentTime + TILE_GROWTH_DELAY,
            originalTile,
          })

          this.map.setCollision(COLLISION_TILES)
        }

        this.tilesToRemove.delete(tileKey)
      }
    }
  }

  processTileRestorations() {
    const currentTime = this.scene.time.now

    for (const [tileKey, { restoreTime, growthStartTime, originalTile }] of this
      .tilesToRestore) {
      if (currentTime >= growthStartTime && !this.growthSprites.has(tileKey)) {
        this.createTileSprite(tileKey, 'growth', this.growthSprites)
      }

      if (currentTime >= restoreTime) {
        this.layer.putTileAt(originalTile.index, originalTile.x, originalTile.y)
        this.map.setCollision(COLLISION_TILES)
        this.destroyTileSprite(tileKey, this.growthSprites)
        this.steppedOnTiles.delete(tileKey)
        this.tilesToRestore.delete(tileKey)
      }
    }
  }

  checkOverlayTileOverlap(): boolean {
    const body = this.scene.player.body
    const leftTileX = Math.floor(body.x / tileSize)
    const rightTileX = Math.floor((body.x + body.width) / tileSize)
    const topTileY = Math.floor(body.y / tileSize)
    const bottomTileY = Math.floor((body.y + body.height) / tileSize)

    for (let x = leftTileX; x <= rightTileX; x++) {
      for (let y = topTileY; y <= bottomTileY; y++) {
        const tile = this.scene.gameMap.overlay.getTileAt(x, y)
        if (tile && tile.index > 0) return true
      }
    }
    return false
  }

  tweenOverlayAlpha(targetAlpha: number) {
    this.overlayAlphaTween?.stop()
    this.overlayAlphaTween = this.scene.tweens.add({
      targets: this.scene.gameMap.overlay,
      alpha: targetAlpha,
      duration: 200,
      ease: 'Sine.easeInOut',
      onComplete: () => (this.overlayAlphaTween = null),
    })
  }

  drawTilePhysicsBodies() {
    this.debugGraphics.clear()

    const adjacent = this.scene.player.getAdjacentTiles()

    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        const tile = this.map.getTileAt(x, y)
        if (!tile || (!tile?.collides && tile.index !== 4 && tile.index !== 5))
          continue

        const color = adjacent.includes(tile) ? 0x00ff00 : 0xff0000
        const worldX = x * tileSize
        const worldY = y * tileSize
        this.debugGraphics.lineStyle(1, color, 0.8)
        this.debugGraphics
          .fillStyle(color, 0.2)
          .fillRect(worldX, worldY, tileSize, tileSize)
          .strokeRect(worldX, worldY, tileSize, tileSize)
      }
    }
  }

  // Public getters for external access
  get tilemap() {
    return this.map
  }

  get tileLayer() {
    return this.layer
  }

  get movingTileSprites() {
    return this.movingTiles.map((tile) => tile.getSprite())
  }

  get widthInPixels() {
    return this.map.widthInPixels
  }

  get heightInPixels() {
    return this.map.heightInPixels
  }

  get width() {
    return this.map.width
  }

  get height() {
    return this.map.height
  }

  getTileAt(x: number, y: number) {
    return this.layer.getTileAt(x, y)
  }
}
