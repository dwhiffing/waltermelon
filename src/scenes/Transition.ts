import { Scene } from 'phaser'

interface TransitionConfig {
  from: string
  to: string
  rows?: number
  cols?: number
  animationDuration?: number
  cellDelay?: number
  fillColor?: number
}

export class TransitionScene extends Scene {
  config: TransitionConfig
  cellWidth: number
  cellHeight: number
  rectangles: Phaser.GameObjects.Rectangle[] = []

  constructor() {
    super('Transition')
  }

  init(config: TransitionConfig) {
    this.config = {
      rows: 9,
      cols: 10,
      animationDuration: 1000,
      cellDelay: 10,
      fillColor: 0x012824,
      ...config,
    }
  }

  create() {
    const { width, height } = this.cameras.main
    this.cellWidth = width / this.config.cols!
    this.cellHeight = height / this.config.rows!

    this.createRectangles()

    if (this.config.from === 'Boot') {
      this.rectangles.forEach((rect) => rect.setScale(1, 1))
      this.scene.launch(this.config.to)
      this.time.delayedCall(100, () => this.startAnimation(false))
    } else {
      this.startAnimation(true)
    }
  }

  createRectangles() {
    this.rectangles = []
    let cellIndex = 0

    for (let row = 0; row < this.config.rows!; row++) {
      for (let col = 0; col < this.config.cols!; col++) {
        const rect = this.createRectangle(row, col)
        this.rectangles.push(rect)
        cellIndex++
      }
    }
  }

  createRectangle(row: number, col: number): Phaser.GameObjects.Rectangle {
    const x = col * this.cellWidth
    const y = row * this.cellHeight
    const centerX = x + this.cellWidth / 2
    const centerY = y + this.cellHeight / 2

    const rect = this.add
      .rectangle(
        centerX,
        centerY,
        this.cellWidth,
        this.cellHeight,
        this.config.fillColor,
      )
      .setOrigin(0.5)
      .setScale(0, 0)

    return rect
  }

  startAnimation(isFill: boolean) {
    this.rectangles.forEach((rect, i, arr) => {
      this.time.delayedCall((this.config.cellDelay || 0) * i, () => {
        this.animateRect(rect, isFill, () => {
          if (i >= arr.length - 1) {
            this.onAnimationComplete(isFill)
          }
        })
      })
    })
  }

  animateRect(
    rect: Phaser.GameObjects.Rectangle,
    isFill: boolean,
    onComplete: () => void,
  ) {
    const targetScale = isFill ? 1 : 0
    const ease = isFill ? 'Sine.easeOut' : 'Sine.easeIn'

    this.tweens.add({
      targets: rect,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: this.config.animationDuration,
      ease,
      onComplete,
    })
  }

  onAnimationComplete(isFill: boolean) {
    if (isFill) {
      this.scene.launch(this.config.to)
      this.time.delayedCall(100, () => this.startAnimation(false))
    } else {
      this.scene.stop(this.config.from)
      this.scene.stop()
    }
  }
}
