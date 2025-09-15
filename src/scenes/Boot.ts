import { Scene } from 'phaser'

export class BootScene extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.load.bitmapFont('wayfarer', 'assets/font.png', 'assets/font.xml')
    this.load.aseprite('player', 'assets/player.png', 'assets/player.json')
    this.load.image('bits', 'assets/bits.png')
    this.load.aseprite('dust', 'assets/dust.png', 'assets/dust.json')
    this.load.image('tiles', 'assets/tiles.png')
    this.load.image('coin', 'assets/coin.png')
    this.load.image('bg', 'assets/bg.png')
    this.load.tilemapTiledJSON('map', 'assets/map.json')
  }

  create() {
    this.anims.createFromAseprite('player')
    this.anims.createFromAseprite('dust')

    this.scene.start('Game')
    // this.scene.start('Menu')
  }
}
