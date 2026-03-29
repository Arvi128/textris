import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'
import type { PreparedTextWithSegments } from '@chenglou/pretext'
import './style.css'

const FONT = '18px Inter, sans-serif'
const BOARD_W = 360
const BOARD_H = 560
const ROW_H = 28
const ROWS = Math.floor(BOARD_H / ROW_H)
const FILL_THRESHOLD = 0.92
const INITIAL_DROP_INTERVAL = 800
const MIN_DROP_INTERVAL = 150
const MOVE_STEP = 4

const TETRIS_COLORS = [
  { fill: '#00dede', light: '#9fffff', dark: '#006868' },
  { fill: '#dede00', light: '#ffff9a', dark: '#686800' },
  { fill: '#c038f0', light: '#eea8ff', dark: '#601878' },
  { fill: '#00d818', light: '#8fff96', dark: '#007010' },
  { fill: '#e01010', light: '#ff9898', dark: '#800808' },
  { fill: '#2038f0', light: '#a0b0ff', dark: '#101878' },
  { fill: '#f08800', light: '#ffd898', dark: '#804000' },
] as const

const WORD_POOL = [
  'hello', 'world', 'text', 'drop', 'line', 'fill', 'row', 'clear',
  'score', 'level', 'next', 'game', 'play', 'word', 'type', 'font',
  'pixel', 'width', 'stack', 'fall', 'land', 'grid', 'move', 'swap',
  'fast', 'slow', 'left', 'right', 'down', 'space', 'key', 'code',
  'canvas', 'render', 'frame', 'loop', 'block', 'piece', 'board',
  'layout', 'measure', 'prepare', 'segment', 'break', 'wrap',
  'spring', 'river', 'ocean', 'cloud', 'storm', 'light', 'dark',
  'AGI', 'AI', 'LLM', 'GPU', 'API', 'CSS', 'DOM',
  '春天', '你好', '世界', '文字',
  'café', 'über', 'naïve',
]

interface MeasuredWord {
  text: string
  width: number
  prepared: PreparedTextWithSegments
}

interface LandedWord {
  text: string
  width: number
  x: number
  row: number
  colorIdx: number
}

interface FallingPiece {
  word: MeasuredWord
  x: number
  y: number
  colorIdx: number
}

type GameState = 'idle' | 'playing' | 'paused' | 'gameover'

const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!
const overlay = document.querySelector<HTMLElement>('#overlay')!
const overlayTitle = document.querySelector<HTMLElement>('#overlayTitle')!
const overlayMsg = document.querySelector<HTMLElement>('#overlayMsg')!
const scoreEl = document.querySelector<HTMLElement>('#score')!
const linesEl = document.querySelector<HTMLElement>('#lines')!
const levelEl = document.querySelector<HTMLElement>('#level')!
const nextQueueEl = document.querySelector<HTMLElement>('#nextQueue')!

let measuredPool: MeasuredWord[] = []
let queue: MeasuredWord[] = []
let landed: LandedWord[] = []
let current: FallingPiece | null = null
let state: GameState = 'idle'
let score = 0
let clearedLines = 0
let level = 1
let dropInterval = INITIAL_DROP_INTERVAL
let lastDrop = 0
let flashRows: Set<number> = new Set()
let flashStart = 0
const FLASH_DURATION = 320

function measureWord(text: string): MeasuredWord {
  const prepared = prepareWithSegments(text, FONT)
  const line = layoutNextLine(prepared, { segmentIndex: 0, graphemeIndex: 0 }, Infinity)
  const width = line ? line.width : 0
  return { text, width, prepared }
}

function initPool() {
  measuredPool = WORD_POOL.map(w => measureWord(w))
}

function randomWord(): MeasuredWord {
  return measuredPool[Math.floor(Math.random() * measuredPool.length)]
}

function fillQueue() {
  while (queue.length < 4) {
    queue.push(randomWord())
  }
}

function renderNextQueue() {
  const items = nextQueueEl.querySelectorAll('.next-word')
  for (let i = 0; i < items.length; i++) {
    const w = queue[i + 1]
    if (w) {
      items[i].textContent = `${w.text}  (${Math.round(w.width)}px)`
    } else {
      items[i].textContent = '—'
    }
  }
}

function showOverlay(title: string, msg: string) {
  overlayTitle.textContent = title
  overlayMsg.innerHTML = msg
  overlay.classList.remove('hidden')
}

function hideOverlay() {
  overlay.classList.add('hidden')
}

function resetGame() {
  landed = []
  queue = []
  current = null
  score = 0
  clearedLines = 0
  level = 1
  dropInterval = INITIAL_DROP_INTERVAL
  lastDrop = 0
  flashRows = new Set()
  fillQueue()
  spawnPiece()
  updateUI()
}

function updateUI() {
  scoreEl.textContent = String(score)
  linesEl.textContent = String(clearedLines)
  levelEl.textContent = String(level)
  renderNextQueue()
}

function spawnPiece() {
  if (queue.length === 0) fillQueue()
  const word = queue.shift()!
  fillQueue()
  const x = (BOARD_W - word.width) / 2
  const colorIdx = Math.floor(Math.random() * TETRIS_COLORS.length)
  current = { word, x, y: 0, colorIdx }
  renderNextQueue()

  if (checkOverlap(current.x, 0, current.word.width)) {
    state = 'gameover'
    current = null
    showOverlay('Game Over', `Score: <strong>${score}</strong> &mdash; ${clearedLines} lines<br>Press <kbd>Space</kbd> to restart`)
  }
}

function rowSegments(row: number): LandedWord[] {
  return landed.filter(w => w.row === row).sort((a, b) => a.x - b.x)
}

function rowFill(row: number): number {
  return rowSegments(row).reduce((sum, w) => sum + w.width, 0)
}

function checkOverlap(x: number, y: number, width: number): boolean {
  const row = Math.floor(y / ROW_H)
  const segs = rowSegments(row)
  for (const seg of segs) {
    if (x < seg.x + seg.width && x + width > seg.x) return true
  }
  return false
}

function findLandingRow(piece: FallingPiece): number {
  const currentRow = Math.floor(piece.y / ROW_H)
  for (let r = currentRow; r < ROWS; r++) {
    if (r === ROWS - 1) return r
    const segs = rowSegments(r)
    for (const seg of segs) {
      if (piece.x < seg.x + seg.width && piece.x + piece.word.width > seg.x) {
        return Math.max(0, r - 1)
      }
    }
  }
  return ROWS - 1
}

function canFitInRow(row: number, width: number, x: number): boolean {
  const segs = rowSegments(row)
  for (const seg of segs) {
    if (x < seg.x + seg.width && x + width > seg.x) return false
  }
  if (x < 0 || x + width > BOARD_W) return false
  return true
}

function lockPiece() {
  if (!current) return
  const row = findLandingRow(current)
  landed.push({
    text: current.word.text,
    width: current.word.width,
    x: current.x,
    row,
    colorIdx: current.colorIdx,
  })
  checkClears()
  current = null
  setTimeout(() => {
    if (state === 'playing') spawnPiece()
  }, 50)
}

function checkClears() {
  const rowsToClear: number[] = []
  for (let r = 0; r < ROWS; r++) {
    if (rowFill(r) / BOARD_W >= FILL_THRESHOLD) {
      rowsToClear.push(r)
    }
  }
  if (rowsToClear.length === 0) {
    updateUI()
    return
  }

  flashRows = new Set(rowsToClear)
  flashStart = performance.now()

  setTimeout(() => {
    flashRows = new Set()
    landed = landed.filter(w => !rowsToClear.includes(w.row))
    rowsToClear.sort((a, b) => a - b)
    for (const cleared of rowsToClear) {
      for (const w of landed) {
        if (w.row < cleared) w.row += 1
      }
    }

    const count = rowsToClear.length
    clearedLines += count
    if (count === 1) score += 100
    else if (count === 2) score += 500
    else score += 300 * count

    level = 1 + Math.floor(clearedLines / 3)
    dropInterval = Math.max(MIN_DROP_INTERVAL, INITIAL_DROP_INTERVAL - (level - 1) * 25)

    updateUI()
  }, FLASH_DURATION)
}

function movePiece(dx: number) {
  if (!current || state !== 'playing') return
  const newX = current.x + dx
  if (newX < 0 || newX + current.word.width > BOARD_W) return
  const targetRow = findLandingRow({ ...current, x: newX })
  const currentRow = Math.floor(current.y / ROW_H)
  if (currentRow <= targetRow && canFitInRow(currentRow, current.word.width, newX)) {
    current.x = newX
  }
}

function softDrop() {
  if (!current || state !== 'playing') return
  current.y += ROW_H
  const landRow = findLandingRow(current)
  if (Math.floor(current.y / ROW_H) >= landRow) {
    current.y = landRow * ROW_H
    lockPiece()
  }
}

function hardDrop() {
  if (!current || state !== 'playing') return
  const landRow = findLandingRow(current)
  current.y = landRow * ROW_H
  lockPiece()
}

function swapWithNext() {
  if (!current || state !== 'playing' || queue.length < 2) return
  const oldWord = current.word
  current.word = queue[1]
  current.colorIdx = Math.floor(Math.random() * TETRIS_COLORS.length)
  current.x = Math.min(current.x, BOARD_W - current.word.width)
  if (current.x < 0) current.x = 0
  queue[1] = oldWord
  renderNextQueue()
}

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
  canvas.style.width = `${BOARD_W}px`
  canvas.style.height = `${BOARD_H}px`
  canvas.width = Math.floor(BOARD_W * dpr)
  canvas.height = Math.floor(BOARD_H * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawBeveledBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorIdx: number,
) {
  const c = TETRIS_COLORS[colorIdx % TETRIS_COLORS.length]!
  const t = 2
  ctx.fillStyle = c.fill
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = c.light
  ctx.fillRect(x, y, w, t)
  ctx.fillRect(x, y, t, h)
  ctx.fillStyle = c.dark
  ctx.fillRect(x, y + h - t, w, t)
  ctx.fillRect(x + w - t, y, t, h)
}

function drawMinoText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number) {
  ctx.font = FONT
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(text, cx, cy)
  ctx.fillStyle = '#f8f8f8'
  ctx.fillText(text, cx, cy)
}

function draw(now: number) {
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0d0d12'
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  for (let r = 1; r < ROWS; r++) {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)'
    ctx.beginPath()
    ctx.moveTo(0, r * ROW_H)
    ctx.lineTo(BOARD_W, r * ROW_H)
    ctx.stroke()
  }

  for (let r = 0; r < ROWS; r++) {
    const fill = rowFill(r)
    if (fill > 0) {
      const pct = fill / BOARD_W
      ctx.fillStyle = `rgba(0, 255, 255, ${0.04 + pct * 0.1})`
      ctx.fillRect(0, r * ROW_H, BOARD_W, ROW_H)

      ctx.fillStyle = 'rgba(0, 255, 200, 0.55)'
      ctx.font = '8px "Press Start 2P", monospace'
      ctx.textBaseline = 'bottom'
      ctx.textAlign = 'left'
      ctx.fillText(`${Math.round(pct * 100)}`, 3, (r + 1) * ROW_H - 3)
    }
  }

  const isFlashing = flashRows.size > 0 && now - flashStart < FLASH_DURATION
  const flashPhase = isFlashing ? Math.sin(((now - flashStart) / FLASH_DURATION) * Math.PI * 4) : 0

  for (const w of landed) {
    const y = w.row * ROW_H
    const flashing = flashRows.has(w.row)

    if (flashing) {
      const alpha = 0.45 + 0.55 * Math.abs(flashPhase)
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillRect(w.x, y, w.width, ROW_H)
      ctx.font = FONT
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#0a0a12'
      ctx.fillText(w.text, w.x, y + ROW_H / 2)
    } else {
      drawBeveledBlock(ctx, w.x, y, w.width, ROW_H, w.colorIdx)
      drawMinoText(ctx, w.text, w.x, y + ROW_H / 2)
    }
  }

  if (current && state === 'playing') {
    const ghostRow = findLandingRow(current)
    const ghostY = ghostRow * ROW_H
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.45)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.strokeRect(current.x + 0.5, ghostY + 0.5, current.word.width - 1, ROW_H - 1)
    ctx.setLineDash([])
    ctx.lineWidth = 1

    drawBeveledBlock(ctx, current.x, current.y, current.word.width, ROW_H, current.colorIdx)
    drawMinoText(ctx, current.word.text, current.x, current.y + ROW_H / 2)

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.strokeRect(current.x + 0.5, current.y + 0.5, current.word.width - 1, ROW_H - 1)

    ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'
    ctx.font = '7px "Press Start 2P", monospace'
    ctx.textBaseline = 'bottom'
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.round(current.word.width)}`, current.x, current.y - 2)
  }

  ctx.strokeStyle = '#00f0f0'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 8
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, BOARD_W - 3, BOARD_H - 3)
  ctx.shadowBlur = 0
  ctx.lineWidth = 1
  ctx.strokeStyle = '#ffff00'
  ctx.strokeRect(0.5, 0.5, BOARD_W - 1, BOARD_H - 1)
}

function gameLoop(now: number) {
  requestAnimationFrame(gameLoop)

  if (state === 'playing' && current) {
    if (now - lastDrop >= dropInterval) {
      lastDrop = now
      current.y += ROW_H
      const landRow = findLandingRow(current)
      if (Math.floor(current.y / ROW_H) >= landRow) {
        current.y = landRow * ROW_H
        lockPiece()
      }
    }
  }

  draw(now)
}

function startGame() {
  hideOverlay()
  resetGame()
  state = 'playing'
  lastDrop = performance.now()
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused'
    showOverlay('Paused', 'Press <kbd>P</kbd> or <kbd>Space</kbd> to resume')
  } else if (state === 'paused') {
    state = 'playing'
    lastDrop = performance.now()
    hideOverlay()
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    if (state === 'idle' || state === 'gameover') startGame()
    else if (state === 'paused') togglePause()
    else if (state === 'playing') hardDrop()
    return
  }

  if (state !== 'playing') {
    if (e.key === 'p' || e.key === 'P') {
      if (state === 'paused') togglePause()
    }
    return
  }

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      movePiece(-MOVE_STEP)
      break
    case 'ArrowRight':
      e.preventDefault()
      movePiece(MOVE_STEP)
      break
    case 'ArrowDown':
      e.preventDefault()
      softDrop()
      break
    case 'ArrowUp':
      e.preventDefault()
      swapWithNext()
      break
    case 'p':
    case 'P':
      togglePause()
      break
  }
})

initPool()
setupCanvas()
showOverlay('Textris', 'Press <kbd>Space</kbd> to start')
fillQueue()
renderNextQueue()
requestAnimationFrame(gameLoop)
