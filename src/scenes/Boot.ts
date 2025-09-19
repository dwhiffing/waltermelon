import { Scene } from 'phaser'

export class BootScene extends Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.load.bitmapFont('wayfarer', 'assets/font.png', 'assets/font.xml')
    this.load.aseprite('player', 'assets/player.png', 'assets/player.json')
    this.load.aseprite('growth', 'assets/growth.png', 'assets/growth.json')
    this.load.aseprite('crack', 'assets/crack.png', 'assets/crack.json')
    this.load.image('bits', 'assets/bits.png')
    this.load.image('crate', 'assets/crate.png')
    this.load.image('title', 'assets/title.png')
    this.load.aseprite('dust', 'assets/dust.png', 'assets/dust.json')
    this.load.spritesheet('tiles', 'assets/tiles.png', {
      frameWidth: 16,
      frameHeight: 16,
    })
    this.load.spritesheet('coin', 'assets/coin.png', {
      frameWidth: 16,
      frameHeight: 16,
    })
    this.load.image('bg', 'assets/bg.png')
    this.load.tilemapTiledJSON('map', 'assets/map.json')
  }

  create() {
    this.anims.createFromAseprite('player')
    this.anims.createFromAseprite('dust')
    this.anims.createFromAseprite('growth')
    this.anims.createFromAseprite('crack')

    // this.scene.start('Game')
    this.scene.start('Menu')
    // this.scene.start('Intro')
  }
}
