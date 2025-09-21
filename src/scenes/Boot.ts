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
    this.load.spritesheet('bits', 'assets/bits.png', {
      frameWidth: 9,
      frameHeight: 9,
    })
    this.load.image('crate', 'assets/crate.png')
    this.load.image('crate-full', 'assets/crate-full.png')
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
    this.load.audio('music', 'assets/music.mp3')
    this.load.audio('music-loop', 'assets/music-loop.mp3')
    this.load.audio('crate-land', 'assets/crate-land.mp3')
    this.load.audio('tile-break', 'assets/tile-break.mp3')
    this.load.audio('slip', 'assets/slip.mp3')
    this.load.audio('voice', 'assets/voice.mp3')
    this.load.audio('jump', 'assets/jump.mp3')
    this.load.audio('step', 'assets/step.mp3')
    this.load.audio('land', 'assets/land.mp3')
    this.load.audio('grab', 'assets/grab.mp3')
    this.load.audio('skid', 'assets/skid.mp3')
    this.load.audio('coin', 'assets/coin.mp3')
    this.load.audio('roll', 'assets/roll.mp3')
    this.load.audio('slide', 'assets/slide.mp3')
    this.load.audio('melon-shoot', 'assets/melon-shoot.mp3')
  }

  create() {
    this.anims.createFromAseprite('player')
    this.anims.createFromAseprite('dust')
    this.anims.createFromAseprite('growth')
    this.anims.createFromAseprite('crack')

    // this.scene.start('Game')
    this.scene.launch('Transition', { from: 'Boot', to: 'Intro' })
  }
}
