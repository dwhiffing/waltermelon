// Tunable movement values. Player reads from MOVE every frame, so the tuning
// panel can change them live.

export type MovementConfig = typeof JAM

// The values the jam build shipped with
const JAM = {
  maxSpeed: 100,
  groundAccel: 160, // px/s² while holding a direction
  groundDecel: 260, // px/s² when no direction is held
  turnAccel: 160, // px/s² when holding against current velocity
  airAccel: 88, // px/s² while airborne
  airDecel: 0, // px/s² airborne with no direction held
  accelTaper: 0.5, // accel shrinks by this much as speed nears max (0 = constant)
  turnLockMs: 100, // no control right after reversing direction
  jumpVelocity: 100,
  jumpHoldMs: 220,
  jumpHoldBoost: 330, // px/s² added while jump is held
  jumpCut: 1, // vy multiplier when jump is released while rising (1 = off)
  fallGravityMult: 1, // gravity multiplier while falling
  maxFallSpeed: 400,
  coyoteMs: 100,
  jumpBufferMs: 0, // jump pressed this early before landing still fires
  softLandKeep: 0.5, // fraction of x speed kept on a short landing
  landLockFallSpeed: 85, // falls faster than this play a landing that blocks input
  standingJumpVX: 45,
  rollSpeed: 200,
}

const TIGHT: MovementConfig = {
  ...JAM,
  maxSpeed: 95,
  groundAccel: 700,
  groundDecel: 900,
  turnAccel: 1400,
  airAccel: 450,
  airDecel: 200,
  accelTaper: 0,
  turnLockMs: 0,
  jumpVelocity: 130,
  jumpHoldMs: 160,
  jumpHoldBoost: 240,
  jumpCut: 0.55,
  fallGravityMult: 1.6,
  maxFallSpeed: 360,
  coyoteMs: 110,
  jumpBufferMs: 120,
  softLandKeep: 1,
  landLockFallSpeed: 300,
  standingJumpVX: 60,
}

export const PRESETS: Record<string, MovementConfig> = {
  Tight: TIGHT,
  Jam: JAM,
}

const STORAGE_KEY = 'waltermelon-movement'

const load = (): MovementConfig => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved) return { ...TIGHT, ...saved }
  } catch {}
  return { ...TIGHT }
}

export const MOVE: MovementConfig = load()

export const saveMovement = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOVE))
  } catch {}
}

export const applyPreset = (name: string) => {
  Object.assign(MOVE, PRESETS[name])
  saveMovement()
}

// Dev builds, or prod builds made with VITE_TUNING=1
export const TUNING_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_TUNING === '1'

// Tuning builds drop straight into the level
export const SKIP_INTRO = import.meta.env.VITE_TUNING === '1'
