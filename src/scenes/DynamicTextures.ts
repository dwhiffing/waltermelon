import { GameScene } from './Game'

export class DynamicTextureManager {
  scene: GameScene
  originalTexture: HTMLImageElement
  dynamicTexture: Phaser.Textures.CanvasTexture
  context: CanvasRenderingContext2D

  constructor(scene: GameScene, key: string) {
    this.scene = scene
    this.originalTexture = this.scene.textures
      .get(key)
      .getSourceImage() as HTMLImageElement

    this.dynamicTexture = this.scene.textures.createCanvas(
      `${key}-dynamic`,
      this.originalTexture.width,
      this.originalTexture.height,
    )!

    this.context = (
      this.dynamicTexture.getSourceImage() as HTMLCanvasElement
    ).getContext('2d')!

    this.context.drawImage(this.originalTexture, 0, 0)
    this.dynamicTexture.refresh()

    const originalTexture = this.scene.textures.get(key)
    const newTexture = this.scene.textures.get(`${key}-dynamic`)

    originalTexture.getFrameNames().forEach((frameName) => {
      const originalFrame = originalTexture.get(frameName)
      newTexture.add(
        frameName,
        0,
        originalFrame.cutX,
        originalFrame.cutY,
        originalFrame.cutWidth,
        originalFrame.cutHeight,
      )
    })

    const animsCache = this.scene.cache.json.get(key)
    if (!animsCache || !animsCache.meta || !animsCache.meta.frameTags) return

    animsCache.meta.frameTags.forEach((tag: any) => {
      const animKey = tag.name

      const frames: any[] = []
      for (let i = tag.from; i <= tag.to; i++) {
        frames.push({ key: `${key}-dynamic`, frame: i.toString() })
      }

      if (this.scene.anims.exists(animKey)) this.scene.anims.remove(animKey)
      this.scene.anims.create({
        key: animKey,
        frames: frames,
        frameRate: 8,
        repeat:
          tag.direction === 'pingpong'
            ? -1
            : animKey.includes('idle') ||
              animKey.includes('walk') ||
              animKey.includes('run')
            ? -1
            : 0,
      })
    })
  }

  swapColor(
    fromColor: { r: number; g: number; b: number },
    toColor: { r: number; g: number; b: number },
  ) {
    this.context.drawImage(
      this.dynamicTexture.getSourceImage() as HTMLCanvasElement,
      0,
      0,
    )
    const { width, height } = this.dynamicTexture

    const imageData = this.context.getImageData(0, 0, width, height)
    const pixels = imageData.data

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      const a = pixels[i + 3]

      if (a === 0) continue

      if (r === fromColor.r && g === fromColor.g && b === fromColor.b) {
        pixels[i] = toColor.r
        pixels[i + 1] = toColor.g
        pixels[i + 2] = toColor.b
      }
    }

    this.context.putImageData(imageData, 0, 0)
    this.dynamicTexture.refresh()
  }

  reset() {
    this.context.drawImage(this.originalTexture, 0, 0)
    this.dynamicTexture.refresh()
  }
}
