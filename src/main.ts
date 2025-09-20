import { BootScene } from './scenes/Boot'
import { GameScene } from './scenes/Game'
import { MenuScene } from './scenes/Menu'
import { IntroScene } from './scenes/Intro'
import { WinScene } from './scenes/Win'
import { TransitionScene } from './scenes/Transition'
import { AudioToggle } from './AudioToggle'

import { Game, Types } from 'phaser'

const config: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 160,
  height: 144,
  parent: 'game-container',
  backgroundColor: '#012824',
  pixelArt: true,
  zoom: 4,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 340, x: 0 },
      fps: 300,
    },
  },
  // scale: {
  //   mode: Phaser.Scale.ZOOM_2X,
  //   // autoCenter: Phaser.Scale.CENTER_BOTH,
  // },
  scene: [
    BootScene,
    IntroScene,
    MenuScene,
    GameScene,
    WinScene,
    TransitionScene,
  ],
}

const game = new Game(config)
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'm') {
    const currentScene = game.scene.getScenes(true)[0]
    if (currentScene) {
      AudioToggle.toggle(currentScene)
    }
  }
})

export default game
