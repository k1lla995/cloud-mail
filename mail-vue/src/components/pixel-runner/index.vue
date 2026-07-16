<template>
  <section
      class="pixel-runner"
      ref="runnerRef"
      :class="{'is-liquid-glass': props.glassEnabled, 'is-resizing': isResizing}"
      :style="runnerStyle"
      :aria-label="t('runnerCanvasLabel')"
      @pointerdown="handleRunnerPointerDown"
  >
    <div class="canvas-wrap">
      <canvas
          ref="canvasRef"
          width="768"
          height="240"
          role="img"
          :aria-label="t('runnerCanvasLabel')"
          @click="handleCanvasClick"
      ></canvas>

      <Transition name="game-over">
        <div v-if="gameOver" class="game-over-backdrop" role="dialog" aria-modal="true" :aria-label="t('runnerGameOver')">
          <div class="game-over-modal">
            <span class="game-over-kicker">{{ t('runnerGameOver') }}</span>
            <strong>{{ finalScore.toString().padStart(5, '0') }}</strong>
            <button type="button" @click.stop="restartGame">
              <Icon icon="material-symbols:replay-rounded" width="19" height="19"/>
              <span>{{ t('runnerRestart') }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <Transition name="game-pause">
        <div v-if="isInteractionPaused && !gameOver && !isResizing" class="game-paused-hint" aria-live="polite">
          <Icon icon="material-symbols:pause-rounded" width="18" height="18"/>
          <span>{{ t('runnerPaused') }}</span>
          <small>{{ t('runnerResumeHint') }}</small>
        </div>
      </Transition>
    </div>

    <button
        v-for="handle in resizeHandles"
        :key="handle"
        type="button"
        class="resize-handle"
        :class="`resize-handle--${handle}`"
        :aria-label="t('runnerResizeHandle')"
        @pointerdown.stop.prevent="startResize($event, handle)"
    >
      <span class="sr-only">{{ t('runnerResizeHandle') }}</span>
    </button>
  </section>
</template>

<script setup>
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {Icon} from '@iconify/vue'
import {useI18n} from 'vue-i18n'

const {t} = useI18n()
const props = defineProps({
  glassEnabled: {
    type: Boolean,
    default: true,
  },
})
const canvasRef = ref(null)
const runnerRef = ref(null)
const gameOver = ref(false)
const finalScore = ref(0)
const isInteractionPaused = ref(false)
const isResizing = ref(false)

const CANVAS_WIDTH = 768
const CANVAS_HEIGHT = 240
const GROUND_Y = 196
const GAME_ASPECT_RATIO = CANVAS_WIDTH / CANVAS_HEIGHT
const MIN_GAME_WIDTH = 268
const MAX_GAME_WIDTH = Math.round(CANVAS_WIDTH * 1.35)
const DEFAULT_GAME_WIDTH = CANVAS_WIDTH
const GAME_SIZE_STORAGE_KEY = 'mailplus.login-runner-width'
const LEGACY_GAME_SCALE_STORAGE_KEY = 'mailplus.login-runner-scale'
const resizeHandles = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']

const gameWidth = ref(DEFAULT_GAME_WIDTH)
const minGameWidth = ref(MIN_GAME_WIDTH)
const maxGameWidth = ref(MAX_GAME_WIDTH)
const runnerStyle = computed(() => ({
  width: `${gameWidth.value}px`,
}))

let game = null
let sizeResizeObserver = null
let resizeSession = null
let resizeFrame = null
let pendingGameWidth = null

function normalizeGameWidth(value, minimum = minGameWidth.value, maximum = maxGameWidth.value) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return Math.min(maximum, Math.max(minimum, DEFAULT_GAME_WIDTH))
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)))
}

function restoreGameWidth() {
  try {
    const savedWidth = window.localStorage.getItem(GAME_SIZE_STORAGE_KEY)
    if (savedWidth) return normalizeGameWidth(savedWidth)

    const legacyScale = Number.parseFloat(window.localStorage.getItem(LEGACY_GAME_SCALE_STORAGE_KEY))
    return Number.isFinite(legacyScale) ? normalizeGameWidth(CANVAS_WIDTH * legacyScale / 100) : DEFAULT_GAME_WIDTH
  } catch {
    return DEFAULT_GAME_WIDTH
  }
}

function persistGameWidth() {
  try {
    window.localStorage.setItem(GAME_SIZE_STORAGE_KEY, String(gameWidth.value))
  } catch {
    // Browsers with disabled storage can still resize for the current session.
  }
}

function updateAvailableSize() {
  const wrapper = runnerRef.value?.parentElement
  if (!wrapper) return

  const wrapperStyle = window.getComputedStyle(wrapper)
  const horizontalPadding = Number.parseFloat(wrapperStyle.paddingLeft) + Number.parseFloat(wrapperStyle.paddingRight)
  const availableWidth = wrapper.clientWidth - horizontalPadding

  maxGameWidth.value = Math.max(1, Math.min(MAX_GAME_WIDTH, Math.round(availableWidth)))
  minGameWidth.value = Math.min(MIN_GAME_WIDTH, maxGameWidth.value)
  gameWidth.value = normalizeGameWidth(gameWidth.value)
}

function pauseGame() {
  if (gameOver.value) return
  isInteractionPaused.value = true
  game?.pause()
}

function resumeGame() {
  if (gameOver.value || isResizing.value || document.hidden) return
  isInteractionPaused.value = false
  game?.resume()
}

function handleRunnerPointerDown(event) {
  if (event.button !== 0 || event.target.closest('.resize-handle, .game-over-backdrop')) return
  resumeGame()
}

function handleCanvasClick(event) {
  if (event.button !== 0 || gameOver.value || isResizing.value) return
  game?.jump()
}

function calculateResizeWidth(event) {
  const {direction, startX, startY, startWidth} = resizeSession
  const horizontalDelta = direction.includes('e') ? event.clientX - startX : startX - event.clientX
  const verticalDelta = (direction.includes('s') ? event.clientY - startY : startY - event.clientY) * GAME_ASPECT_RATIO

  if (direction.length === 1) {
    return startWidth + (direction === 'e' || direction === 'w' ? horizontalDelta : verticalDelta)
  }

  return startWidth + (Math.abs(horizontalDelta) >= Math.abs(verticalDelta) ? horizontalDelta : verticalDelta)
}

function queueResize(width) {
  pendingGameWidth = normalizeGameWidth(width)
  if (resizeFrame) return

  resizeFrame = requestAnimationFrame(() => {
    gameWidth.value = pendingGameWidth
    resizeFrame = null
  })
}

function handleResizeMove(event) {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) return
  queueResize(calculateResizeWidth(event))
}

function finishResize(event) {
  if (!resizeSession || (event?.pointerId && event.pointerId !== resizeSession.pointerId)) return
  if (resizeFrame) {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = null
  }
  if (pendingGameWidth !== null) gameWidth.value = pendingGameWidth

  persistGameWidth()
  pendingGameWidth = null
  resizeSession = null
  isResizing.value = false
  document.removeEventListener('pointermove', handleResizeMove)
  document.removeEventListener('pointerup', finishResize)
  document.removeEventListener('pointercancel', finishResize)
}

function startResize(event, direction) {
  if (event.button !== 0 || !runnerRef.value) return

  pauseGame()
  isResizing.value = true
  resizeSession = {
    direction,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startWidth: gameWidth.value,
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  document.addEventListener('pointermove', handleResizeMove)
  document.addEventListener('pointerup', finishResize)
  document.addEventListener('pointercancel', finishResize)
}

class Player {
  constructor() {
    this.width = 28
    this.height = 40
    this.x = 88
    this.reset()
  }

  reset() {
    this.y = GROUND_Y - this.height
    this.velocityY = 0
    this.grounded = true
    this.runFrame = 0
    this.runClock = 0
  }

  jump() {
    if (!this.grounded) return

    // Jumping is an initial upward impulse. Gravity reverses it over time,
    // creating a consistent arc instead of a fixed-position animation.
    this.velocityY = -610
    this.grounded = false
  }

  update(delta) {
    if (!this.grounded) {
      // Velocity and position both use delta time, so the physics remain
      // stable on screens with different refresh rates.
      const gravity = 1700
      this.velocityY += gravity * delta
      this.y += this.velocityY * delta

      if (this.y >= GROUND_Y - this.height) {
        this.y = GROUND_Y - this.height
        this.velocityY = 0
        this.grounded = true
      }
    }

    this.runClock += delta
    if (this.runClock >= 0.1) {
      this.runFrame = (this.runFrame + 1) % 2
      this.runClock = 0
    }
  }

  draw(ctx) {
    const x = Math.round(this.x)
    const y = Math.round(this.y)
    const legOffset = this.grounded ? this.runFrame * 3 : 1

    // Red cap, warm face and blue overalls are deliberately separate blocks,
    // making each group easy to replace with sprite-sheet drawImage calls.
    ctx.fillStyle = '#d9362b'
    ctx.fillRect(x + 5, y, 18, 6)
    ctx.fillRect(x + 2, y + 5, 24, 5)
    ctx.fillStyle = '#f5b66b'
    ctx.fillRect(x + 7, y + 10, 16, 10)
    ctx.fillStyle = '#312c2a'
    ctx.fillRect(x + 18, y + 12, 3, 3)
    ctx.fillRect(x + 4, y + 15, 5, 3)
    ctx.fillStyle = '#d9362b'
    ctx.fillRect(x + 4, y + 20, 20, 7)
    ctx.fillStyle = '#1769aa'
    ctx.fillRect(x + 7, y + 25, 14, 9)
    ctx.fillRect(x + 3, y + 27, 5, 5)
    ctx.fillRect(x + 20, y + 27, 5, 5)
    ctx.fillStyle = '#453629'
    ctx.fillRect(x + 5 - legOffset, y + 34, 8, 6)
    ctx.fillRect(x + 16 + legOffset, y + 34, 8, 6)
  }
}

class Obstacle {
  constructor(type, speed) {
    this.type = type
    this.speed = speed
    this.passed = false
    this.x = CANVAS_WIDTH + 24

    if (type === 'crate') {
      this.width = 34
      this.height = 34
    } else {
      this.width = 34
      this.height = 44 + Math.floor(Math.random() * 3) * 8
    }

    this.y = GROUND_Y - this.height
  }

  update(delta, speed) {
    this.x -= speed * delta
  }

  draw(ctx) {
    const x = Math.round(this.x)
    const y = Math.round(this.y)

    if (this.type === 'crate') {
      ctx.fillStyle = '#a95521'
      ctx.fillRect(x, y, this.width, this.height)
      ctx.fillStyle = '#d98635'
      ctx.fillRect(x + 4, y + 4, this.width - 8, this.height - 8)
      ctx.fillStyle = '#7e3b18'
      ctx.fillRect(x + 7, y + 7, 5, 20)
      ctx.fillRect(x + 22, y + 7, 5, 20)
      ctx.fillRect(x + 7, y + 14, 20, 5)
      return
    }

    ctx.fillStyle = '#177a4b'
    ctx.fillRect(x + 6, y + 8, this.width - 12, this.height - 8)
    ctx.fillStyle = '#27a65f'
    ctx.fillRect(x + 2, y, this.width - 4, 13)
    ctx.fillStyle = '#62d27f'
    ctx.fillRect(x + 8, y + 4, 5, this.height - 8)
    ctx.fillStyle = '#10643d'
    ctx.fillRect(x + this.width - 10, y + 13, 5, this.height - 13)
  }
}

class Game {
  constructor(canvas, onGameOver, isGlassEnabled) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.ctx.imageSmoothingEnabled = false
    this.onGameOver = onGameOver
    this.isGlassEnabled = isGlassEnabled
    this.player = new Player()
    this.animationId = null
    this.loop = this.loop.bind(this)
    this.reset()
  }

  reset() {
    cancelAnimationFrame(this.animationId)
    this.player.reset()
    this.obstacles = []
    this.elapsed = 0
    this.score = 0
    this.passed = 0
    this.spawnClock = 0
    this.nextSpawn = 1.35
    this.lastTime = performance.now()
    this.running = true
    this.animationId = requestAnimationFrame(this.loop)
  }

  pause() {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.animationId)
  }

  resume() {
    if (this.running || gameOver.value) return
    this.running = true
    this.lastTime = performance.now()
    this.animationId = requestAnimationFrame(this.loop)
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.animationId)
  }

  jump() {
    if (this.running) this.player.jump()
  }

  loop(now) {
    if (!this.running) return

    const delta = Math.min((now - this.lastTime) / 1000, 0.032)
    this.lastTime = now
    this.update(delta)
    this.draw()

    if (this.running) this.animationId = requestAnimationFrame(this.loop)
  }

  update(delta) {
    this.elapsed += delta
    const speed = 228 + Math.min(this.elapsed * 3.8, 132)
    this.score = Math.floor(this.elapsed * 10) + this.passed * 50
    this.player.update(delta)

    this.spawnClock += delta
    if (this.spawnClock >= this.nextSpawn) {
      const type = Math.random() > 0.28 ? 'pipe' : 'crate'
      this.obstacles.push(new Obstacle(type, speed))
      this.spawnClock = 0
      this.nextSpawn = 1.15 + Math.random() * 0.8
    }

    this.obstacles.forEach(obstacle => {
      obstacle.update(delta, speed)
      if (!obstacle.passed && obstacle.x + obstacle.width < this.player.x) {
        obstacle.passed = true
        this.passed += 1
      }
    })
    this.obstacles = this.obstacles.filter(obstacle => obstacle.x + obstacle.width > -20)

    if (this.obstacles.some(obstacle => this.collides(this.player, obstacle))) {
      this.running = false
      cancelAnimationFrame(this.animationId)
      this.onGameOver(this.score)
    }
  }

  collides(player, obstacle) {
    // Axis-aligned bounding boxes are inset a few pixels around the character.
    // The inset makes near-miss jumps feel fair while still matching the visible
    // blocks closely. Overlap on both axes means a collision occurred.
    const playerBox = {
      left: player.x + 4,
      right: player.x + player.width - 4,
      top: player.y + 3,
      bottom: player.y + player.height - 2,
    }
    const obstacleBox = {
      left: obstacle.x + 2,
      right: obstacle.x + obstacle.width - 2,
      top: obstacle.y + 2,
      bottom: obstacle.y + obstacle.height,
    }

    return playerBox.right > obstacleBox.left
        && playerBox.left < obstacleBox.right
        && playerBox.bottom > obstacleBox.top
        && playerBox.top < obstacleBox.bottom
  }

  draw() {
    const ctx = this.ctx
    const glassEnabled = this.isGlassEnabled()
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // In glass mode the canvas remains translucent, allowing the CSS
    // backdrop-filter on the game shell to sample the uploaded background.
    ctx.fillStyle = glassEnabled ? 'rgba(238, 247, 252, 0.08)' : '#67c7ee'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    this.drawCloud(ctx, 86 - (this.elapsed * 8) % 920, 34, glassEnabled)
    this.drawCloud(ctx, 438 - (this.elapsed * 5) % 980, 62, glassEnabled)

    ctx.fillStyle = glassEnabled ? 'rgba(141, 217, 90, 0.48)' : '#8dd95a'
    ctx.fillRect(0, 146, CANVAS_WIDTH, 50)
    ctx.fillStyle = glassEnabled ? 'rgba(93, 189, 69, 0.62)' : '#5dbd45'
    for (let x = -30; x < CANVAS_WIDTH + 50; x += 90) {
      const offset = -((this.elapsed * 18) % 90)
      ctx.fillRect(x + offset, 132, 48, 64)
      ctx.fillRect(x + 14 + offset, 120, 20, 76)
    }

    ctx.fillStyle = glassEnabled ? 'rgba(86, 60, 43, 0.72)' : '#7e4625'
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)
    ctx.fillStyle = glassEnabled ? 'rgba(213, 138, 58, 0.78)' : '#d58a3a'
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 8)
    ctx.fillStyle = glassEnabled ? 'rgba(99, 67, 44, 0.58)' : '#9f5b29'
    const groundOffset = -Math.floor((this.elapsed * 110) % 24)
    for (let x = groundOffset; x < CANVAS_WIDTH; x += 24) {
      ctx.fillRect(x, GROUND_Y + 16, 12, 5)
      ctx.fillRect(x + 12, GROUND_Y + 31, 12, 5)
    }

    this.obstacles.forEach(obstacle => obstacle.draw(ctx))
    this.player.draw(ctx)

    ctx.fillStyle = '#142d3d'
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${t('runnerScore')} ${this.score.toString().padStart(5, '0')}`, CANVAS_WIDTH - 18, 25)
    ctx.textAlign = 'left'
  }

  drawCloud(ctx, x, y, glassEnabled) {
    const wrappedX = x < -100 ? x + 920 : x
    ctx.fillStyle = glassEnabled ? 'rgba(255, 255, 255, 0.52)' : '#ffffff'
    ctx.fillRect(Math.round(wrappedX), y + 12, 70, 14)
    ctx.fillRect(Math.round(wrappedX + 12), y + 5, 24, 21)
    ctx.fillRect(Math.round(wrappedX + 38), y, 22, 26)
  }
}

function isEditableElement(element) {
  if (!(element instanceof Element)) return false
  return Boolean(element.closest('input, textarea, select, button, a, [contenteditable="true"], .form-wrapper, .el-dialog'))
}

function isInsideRunner(element) {
  return element instanceof Node && runnerRef.value?.contains(element)
}

function handleKeydown(event) {
  if (isEditableElement(event.target) || isEditableElement(document.activeElement)) {
    pauseGame()
    return
  }
  if (event.code !== 'Space' || event.repeat || isInteractionPaused.value) return
  event.preventDefault()
  game?.jump()
}

function handleDocumentPointerDown(event) {
  if (event.button !== 0 || isInsideRunner(event.target)) return
  pauseGame()
}

function handleFocusIn(event) {
  if (isEditableElement(event.target) && !isInsideRunner(event.target)) pauseGame()
}

function handleVisibilityChange() {
  if (document.hidden) game?.pause()
  else if (!isInteractionPaused.value) game?.resume()
}

function restartGame() {
  finalScore.value = 0
  gameOver.value = false
  isInteractionPaused.value = false
  game?.reset()
}

onMounted(() => {
  updateAvailableSize()
  gameWidth.value = normalizeGameWidth(restoreGameWidth())
  if ('ResizeObserver' in window) {
    sizeResizeObserver = new ResizeObserver(updateAvailableSize)
    sizeResizeObserver.observe(runnerRef.value.parentElement)
  } else {
    window.addEventListener('resize', updateAvailableSize)
  }

  game = new Game(canvasRef.value, score => {
    finalScore.value = score
    gameOver.value = true
  }, () => props.glassEnabled)

  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  game?.destroy()
  finishResize()
  sizeResizeObserver?.disconnect()
  window.removeEventListener('resize', updateAvailableSize)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.pixel-runner {
  --pixel-ink: #173548;
  position: relative;
  isolation: isolate;
  width: min(720px, 100%);
  max-width: 100%;
  overflow: visible;
  border: 3px solid var(--pixel-ink);
  border-radius: 6px;
  background: #f8e6ad;
  box-shadow: 8px 8px 0 rgba(20, 45, 61, 0.22);
  font-family: "Courier New", monospace;
}

.pixel-runner.is-liquid-glass {
  --glass-surface: rgba(255, 255, 255, 0.08);
  --glass-edge: rgba(255, 255, 255, 0.34);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  background: var(--glass-surface);
  box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.42),
      inset 0 -1px 0 rgba(255, 255, 255, 0.08),
      0 24px 64px rgba(15, 23, 42, 0.18),
      0 4px 14px rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(28px) saturate(180%) brightness(1.08);
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.08);
}

.pixel-runner.is-liquid-glass::before {
  content: '';
  position: absolute;
  z-index: 4;
  top: 7px;
  right: 11%;
  width: 22%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.44);
  filter: blur(5px);
  pointer-events: none;
}

:global(.dark) .pixel-runner.is-liquid-glass {
  --pixel-ink: #eef6fb;
  --glass-surface: rgba(8, 15, 24, 0.10);
  --glass-edge: rgba(255, 255, 255, 0.18);
  box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.20),
      inset 0 -1px 0 rgba(255, 255, 255, 0.04),
      0 26px 70px rgba(0, 0, 0, 0.28),
      0 4px 16px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(28px) saturate(165%) brightness(0.88);
  -webkit-backdrop-filter: blur(28px) saturate(165%) brightness(0.88);
}

@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .pixel-runner.is-liquid-glass {
    background: rgba(244, 248, 252, 0.72);
  }

  :global(.dark) .pixel-runner.is-liquid-glass {
    background: rgba(17, 24, 34, 0.76);
  }
}

.resize-handle {
  position: absolute;
  z-index: 20;
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  opacity: 0.38;
  touch-action: none;
  transition: opacity 160ms ease;
}

.resize-handle::after {
  content: '';
  position: absolute;
  background: var(--pixel-ink);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.68);
}

.pixel-runner:hover .resize-handle,
.pixel-runner:focus-within .resize-handle,
.pixel-runner.is-resizing .resize-handle {
  opacity: 0.92;
}

.resize-handle--n,
.resize-handle--s {
  left: 26px;
  right: 26px;
  height: 14px;
  cursor: ns-resize;
}

.resize-handle--n {
  top: -7px;
}

.resize-handle--s {
  bottom: -7px;
}

.resize-handle--n::after,
.resize-handle--s::after {
  top: 5px;
  left: 50%;
  width: 34px;
  height: 4px;
  border-radius: 999px;
  transform: translateX(-50%);
}

.resize-handle--e,
.resize-handle--w {
  top: 26px;
  bottom: 26px;
  width: 14px;
  cursor: ew-resize;
}

.resize-handle--e {
  right: -7px;
}

.resize-handle--w {
  left: -7px;
}

.resize-handle--e::after,
.resize-handle--w::after {
  top: 50%;
  left: 5px;
  width: 4px;
  height: 34px;
  border-radius: 999px;
  transform: translateY(-50%);
}

.resize-handle--ne,
.resize-handle--nw,
.resize-handle--se,
.resize-handle--sw {
  width: 18px;
  height: 18px;
}

.resize-handle--ne,
.resize-handle--nw {
  top: -9px;
}

.resize-handle--se,
.resize-handle--sw {
  bottom: -9px;
}

.resize-handle--ne,
.resize-handle--se {
  right: -9px;
}

.resize-handle--nw,
.resize-handle--sw {
  left: -9px;
}

.resize-handle--ne,
.resize-handle--sw {
  cursor: nesw-resize;
}

.resize-handle--nw,
.resize-handle--se {
  cursor: nwse-resize;
}

.resize-handle--ne::after,
.resize-handle--nw::after,
.resize-handle--se::after,
.resize-handle--sw::after {
  top: 4px;
  left: 4px;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.is-liquid-glass .resize-handle::after {
  background: color-mix(in srgb, var(--pixel-ink) 84%, white);
  box-shadow: 0 1px 5px rgba(15, 23, 42, 0.24);
}

:global(.dark) .is-liquid-glass .resize-handle::after {
  background: rgba(255, 255, 255, 0.9);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.canvas-wrap {
  position: relative;
  aspect-ratio: 768 / 240;
  overflow: hidden;
  border-radius: inherit;
}

.is-liquid-glass .canvas-wrap {
  background: transparent;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  cursor: pointer;
}

.game-paused-hint {
  position: absolute;
  z-index: 6;
  top: 50%;
  left: 50%;
  min-width: 138px;
  padding: 9px 13px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 7px;
  color: var(--pixel-ink);
  background: rgba(255, 244, 199, 0.88);
  border: 2px solid var(--pixel-ink);
  box-shadow: 4px 4px 0 rgba(20, 45, 61, 0.24);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.game-paused-hint span {
  font-size: 13px;
  font-weight: 800;
}

.game-paused-hint small {
  grid-column: 2;
  margin-top: 1px;
  font-size: 10px;
  opacity: 0.76;
}

.is-liquid-glass .game-paused-hint {
  background: rgba(248, 250, 252, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 14px 36px rgba(15, 23, 42, 0.22);
  backdrop-filter: blur(14px) saturate(150%) brightness(1.04);
  -webkit-backdrop-filter: blur(14px) saturate(150%) brightness(1.04);
}

.game-over-backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 12px;
  background: rgba(20, 45, 61, 0.48);
}

.is-liquid-glass .game-over-backdrop {
  z-index: 8;
  background: rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(8px) saturate(140%) brightness(0.96);
  -webkit-backdrop-filter: blur(8px) saturate(140%) brightness(0.96);
}

.game-over-modal {
  width: min(260px, calc(100% - 24px));
  padding: 16px 18px;
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--pixel-ink);
  background: #fff4c7;
  border: 3px solid var(--pixel-ink);
  box-shadow: 6px 6px 0 rgba(20, 45, 61, 0.32);
}

.is-liquid-glass .game-over-modal {
  background: rgba(248, 250, 252, 0.58);
  background: color-mix(in srgb, var(--el-bg-color) 54%, transparent);
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.34), 0 18px 50px rgba(15, 23, 42, 0.22);
  backdrop-filter: blur(22px) saturate(165%) brightness(1.04);
  -webkit-backdrop-filter: blur(22px) saturate(165%) brightness(1.04);
}

.game-over-kicker {
  font-size: 12px;
  font-weight: 800;
}

.game-over-modal strong {
  font-size: 28px;
  line-height: 1;
}

.game-over-modal button {
  min-height: 34px;
  margin-top: 3px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fff;
  background: #d9362b;
  border: 2px solid var(--pixel-ink);
  border-radius: 2px;
  box-shadow: 3px 3px 0 var(--pixel-ink);
  cursor: pointer;
  font-weight: 800;
}

.game-over-modal button:hover {
  background: #bd2c24;
}

.game-over-modal button:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--pixel-ink);
}

.game-over-enter-active,
.game-over-leave-active {
  transition: opacity 150ms ease;
}

.game-over-enter-from,
.game-over-leave-to {
  opacity: 0;
}

.game-pause-enter-active,
.game-pause-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.game-pause-enter-from,
.game-pause-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 6px));
}

@media (max-width: 480px) {
  .pixel-runner {
    border-width: 2px;
    box-shadow: 5px 5px 0 rgba(20, 45, 61, 0.2);
  }

  .pixel-runner.is-liquid-glass {
    border-width: 1px;
    border-radius: 14px;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.36),
        0 14px 38px rgba(15, 23, 42, 0.18);
  }

  .resize-handle--n,
  .resize-handle--s {
    left: 18px;
    right: 18px;
  }

  .resize-handle--e,
  .resize-handle--w {
    top: 18px;
    bottom: 18px;
  }

  .game-over-modal {
    padding: 10px 14px;
    gap: 5px;
  }

  .game-over-modal strong {
    font-size: 22px;
  }
}
</style>
