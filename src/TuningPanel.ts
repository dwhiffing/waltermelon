import GUI from 'lil-gui'
import { MOVE, PRESETS, applyPreset, saveMovement } from './movement'

// Live movement tuning, only mounted when TUNING_ENABLED
export const createTuningPanel = (game: Phaser.Game) => {
  const gui = new GUI({ title: 'Movement tuning' })
  ;(window as any).game = game

  // keep the game clear of the panel, and hand keys back to the game after edits
  const app = document.getElementById('app')!
  app.style.boxSizing = 'border-box'
  app.style.paddingRight = '260px'
  gui.onFinishChange(() => (document.activeElement as HTMLElement)?.blur())
  const state = { preset: 'Tight' }

  const restart = () => game.scene.getScene('Game')?.scene.restart()

  const copyValues = () => {
    const text = JSON.stringify(MOVE, null, 2)
    navigator.clipboard?.writeText(text).catch(() => window.prompt('', text))
    console.log(text)
  }

  gui
    .add(state, 'preset', Object.keys(PRESETS))
    .name('Preset')
    .onChange((name: string) => {
      applyPreset(name)
      gui.controllersRecursive().forEach((c) => c.updateDisplay())
    })
  gui.add({ restart }, 'restart').name('Restart at spawn (R)')
  gui.add({ copyValues }, 'copyValues').name('Copy values')

  const folder = (name: string, rows: [keyof typeof MOVE, number, number, number][]) => {
    const f = gui.addFolder(name)
    rows.forEach(([key, min, max, step]) =>
      f.add(MOVE, key, min, max, step).onChange(saveMovement),
    )
  }

  folder('Run', [
    ['maxSpeed', 40, 200, 1],
    ['groundAccel', 50, 3000, 10],
    ['groundDecel', 0, 3000, 10],
    ['turnAccel', 50, 4000, 10],
    ['accelTaper', 0, 1, 0.05],
    ['turnLockMs', 0, 300, 10],
  ])
  folder('Air', [
    ['airAccel', 0, 2000, 10],
    ['airDecel', 0, 2000, 10],
    ['standingJumpVX', 0, 150, 1],
  ])
  folder('Jump', [
    ['jumpVelocity', 50, 250, 1],
    ['jumpHoldMs', 0, 400, 10],
    ['jumpHoldBoost', 0, 600, 10],
    ['jumpCut', 0, 1, 0.05],
    ['fallGravityMult', 0.5, 3, 0.05],
    ['maxFallSpeed', 100, 600, 10],
    ['coyoteMs', 0, 250, 10],
    ['jumpBufferMs', 0, 250, 10],
  ])
  folder('Landing and roll', [
    ['landLockFallSpeed', 0, 500, 5],
    ['softLandKeep', 0, 1, 0.05],
    ['rollSpeed', 50, 400, 5],
  ])

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && !(e.target instanceof HTMLInputElement))
      restart()
  })
}
