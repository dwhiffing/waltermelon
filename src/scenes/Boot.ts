import { Scene } from 'phaser'

export class BootScene extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.load.bitmapFont('wayfarer', 'assets/font.png', 'assets/font.xml')
    this.load.aseprite('player', 'assets/player.png', 'assets/player.json')
    this.load.image('tiles', 'assets/tiles.png')
    this.load.image('coin', 'assets/coin.png')
    this.load.tilemapTiledJSON('map', 'assets/map.json')
  }

  create() {
    this.anims.createFromAseprite('player')

    this.scene.start('Game')
    // this.scene.start('Menu')
  }
}
