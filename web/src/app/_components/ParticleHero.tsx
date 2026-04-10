"use client"

import { useEffect, useRef } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }
interface Vec2 { x: number; y: number }

// ─── Particle ─────────────────────────────────────────────────────────────────

class Particle {
  pos: Vec2 = { x: 0, y: 0 }
  vel: Vec2 = { x: 0, y: 0 }
  acc: Vec2 = { x: 0, y: 0 }
  target: Vec2 = { x: 0, y: 0 }
  maxSpeed = 5
  maxForce = 0.25
  closeEnoughTarget = 100
  isKilled = false
  startColor: RGB = { r: 0, g: 0, b: 0 }
  targetColor: RGB = { r: 0, g: 0, b: 0 }
  colorWeight = 0
  colorBlendRate = 0.015

  move() {
    const dx = this.target.x - this.pos.x
    const dy = this.target.y - this.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const prox = dist < this.closeEnoughTarget ? dist / this.closeEnoughTarget : 1

    const desired = { x: (dx / dist) * this.maxSpeed * prox, y: (dy / dist) * this.maxSpeed * prox }
    const steer = { x: desired.x - this.vel.x, y: desired.y - this.vel.y }
    const sm = Math.sqrt(steer.x * steer.x + steer.y * steer.y) || 1
    this.acc.x += (steer.x / sm) * this.maxForce
    this.acc.y += (steer.y / sm) * this.maxForce

    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.colorWeight < 1) this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1)
    const r = Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight)
    const g = Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight)
    const b = Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(this.pos.x, this.pos.y, 3, 3)
  }

  kill(w: number, h: number) {
    if (this.isKilled) return
    const angle = Math.random() * Math.PI * 2
    const mag = (w + h) / 2
    this.target = { x: w / 2 + Math.cos(angle) * mag, y: h / 2 + Math.sin(angle) * mag }
    this.startColor = lerp3(this.startColor, this.targetColor, this.colorWeight)
    this.targetColor = { r: 0, g: 0, b: 0 }
    this.colorWeight = 0
    this.isKilled = true
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp3(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

function spawnOrRecycle(pool: Particle[], index: number, w: number, h: number): Particle {
  if (index < pool.length) {
    pool[index].isKilled = false
    return pool[index]
  }
  const p = new Particle()
  const angle = Math.random() * Math.PI * 2
  const mag = (w + h) / 2
  p.pos = { x: w / 2 + Math.cos(angle) * mag * Math.random(), y: h / 2 + Math.sin(angle) * mag * Math.random() }
  p.maxSpeed = Math.random() * 5 + 3
  p.maxForce = p.maxSpeed * 0.05
  p.colorBlendRate = Math.random() * 0.02 + 0.005
  pool.push(p)
  return p
}

function sampleOffscreen(
  off: HTMLCanvasElement,
  canvas: HTMLCanvasElement,
  pool: Particle[],
  colorFn: (x: number, y: number) => RGB,
) {
  const ctx = off.getContext("2d")!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const STEP = 5

  const coords: number[] = []
  for (let i = 0; i < data.length; i += STEP * 4) {
    if (data[i + 3] > 0) coords.push(i)
  }
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[coords[i], coords[j]] = [coords[j], coords[i]]
  }

  let idx = 0
  for (const ci of coords) {
    const x = (ci / 4) % canvas.width
    const y = Math.floor(ci / 4 / canvas.width)
    const p = spawnOrRecycle(pool, idx++, canvas.width, canvas.height)
    p.startColor = lerp3(p.startColor, p.targetColor, p.colorWeight)
    p.targetColor = colorFn(x, y)
    p.colorWeight = 0
    p.target = { x, y }
  }
  for (let i = idx; i < pool.length; i++) pool[i].kill(canvas.width, canvas.height)
}

// ─── Argentina outline (normalized 0–1, clockwise from NW) ───────────────────
// Bounding box: lon [-73.6, -53.6], lat [-55.1, -21.8]
// nx = (lon + 73.6) / 20,  ny = (lat + 21.8) / -33.3

const ARGENTINA: [number, number][] = [
  // NW corner (Bolivia border, Jujuy)
  [0.23, 0.01],
  // North border (Bolivia) going east
  [0.38, 0.01],
  [0.49, 0.00],
  [0.57, 0.01],
  // Paraguay border going SE (Formosa / Chaco)
  [0.68, 0.02],
  [0.77, 0.05],
  [0.79, 0.07],
  // NE Misiones — sticks out east toward Iguazú
  [0.95, 0.11],
  [1.00, 0.14],
  [1.00, 0.19],
  // East coast going south (Corrientes / Entre Ríos / Uruguay border)
  [0.79, 0.25],
  [0.79, 0.37],
  // Buenos Aires province coast (bulges east then curves back)
  [0.84, 0.43],
  [0.81, 0.49],
  [0.74, 0.51],
  // Bahía Blanca area
  [0.57, 0.52],
  // Patagonia Atlantic coast going south
  [0.55, 0.58],
  [0.43, 0.63],
  [0.41, 0.65],
  [0.38, 0.70],
  [0.38, 0.76],
  [0.40, 0.82],
  [0.38, 0.85],
  [0.31, 0.88],
  [0.23, 0.91],  // Near Strait of Magellan
  // West side (Andes / Chile border) going north
  [0.18, 0.88],
  [0.11, 0.79],
  [0.08, 0.70],
  [0.07, 0.61],
  [0.11, 0.52],
  [0.16, 0.40],
  [0.19, 0.31],
  [0.26, 0.19],
  [0.23, 0.10],
  [0.23, 0.01],  // Back to NW start
]

// Tierra del Fuego (Argentine portion of the main island)
const TIERRA_DEL_FUEGO: [number, number][] = [
  [0.25, 0.92],  // NW (Strait of Magellan, east end)
  [0.38, 0.92],  // N coast going east
  [0.50, 0.93],  // NE corner
  [0.43, 0.99],  // SE tip
  [0.27, 0.99],  // SW corner
]

const GREEN_BRIGHT: RGB = { r: 110, g: 231, b: 183 }

// ─── Phase functions ──────────────────────────────────────────────────────────

function drawPolygon(ctx: CanvasRenderingContext2D, poly: [number, number][], ox: number, oy: number, sw: number, sh: number) {
  ctx.beginPath()
  poly.forEach(([nx, ny], i) => {
    const px = ox + nx * sw, py = oy + ny * sh
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fill()
}

function showMap(canvas: HTMLCanvasElement, pool: Particle[]) {
  const W = canvas.width, H = canvas.height, PAD = 25
  // Argentina is ~2× taller than wide — scale width to preserve real proportions
  const argH = H - PAD * 2
  const argW = argH * 0.49          // true width/height ratio ≈ 0.49
  const argX = (W - argW) / 2, argY = PAD

  const off = document.createElement("canvas")
  off.width = W; off.height = H
  const ctx = off.getContext("2d")!
  ctx.fillStyle = "white"

  drawPolygon(ctx, ARGENTINA, argX, argY, argW, argH)
  drawPolygon(ctx, TIERRA_DEL_FUEGO, argX, argY, argW, argH)

  sampleOffscreen(off, canvas, pool, () => GREEN_BRIGHT)
}

function showText(canvas: HTMLCanvasElement, pool: Particle[]) {
  const W = canvas.width, H = canvas.height
  const off = document.createElement("canvas")
  off.width = W; off.height = H
  const ctx = off.getContext("2d")!
  ctx.fillStyle = "white"
  ctx.font = `bold 130px "IBM Plex Sans", sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("CargaBack", W / 2, H / 2)

  sampleOffscreen(off, canvas, pool, () => GREEN_BRIGHT)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pool = useRef<Particle[]>([])
  const frame = useRef(0)
  const phase = useRef<"map" | "text">("map")

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = 2500
    canvas.height = 900

    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return
      showMap(canvas, pool.current)

      const loop = () => {
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "rgba(0,0,0,0.13)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        for (let i = pool.current.length - 1; i >= 0; i--) {
          const p = pool.current[i]
          p.move()
          p.draw(ctx)
          if (p.isKilled) {
            const { x, y } = p.pos
            if (x < -120 || x > canvas.width + 120 || y < -120 || y > canvas.height + 120) {
              pool.current.splice(i, 1)
            }
          }
        }

        frame.current++

        if (frame.current === 420 && phase.current === "map") {
          phase.current = "text"
          showText(canvas, pool.current)
        }

        animRef.current = requestAnimationFrame(loop)
      }

      loop()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
    />
  )
}
