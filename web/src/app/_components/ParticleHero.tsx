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

// ─── South America outline (normalized 0–1) ───────────────────────────────────

const SA: [number, number][] = [
  [0.43, 0.00], [0.48, 0.00], [0.52, 0.01], [0.57, 0.02],
  [0.62, 0.04], [0.66, 0.06], [0.70, 0.09], [0.72, 0.13],
  [0.74, 0.18], [0.75, 0.24], [0.74, 0.30], [0.76, 0.36],
  [0.77, 0.42], [0.75, 0.48], [0.72, 0.54], [0.68, 0.60],
  [0.64, 0.66], [0.60, 0.72], [0.55, 0.78], [0.50, 0.84],
  [0.46, 0.89], [0.42, 0.93], [0.39, 0.97], [0.36, 0.99],
  [0.34, 1.00], [0.32, 0.98], [0.30, 0.94], [0.28, 0.89],
  [0.26, 0.84], [0.24, 0.79], [0.23, 0.73], [0.21, 0.67],
  [0.20, 0.61], [0.20, 0.55], [0.20, 0.49], [0.21, 0.43],
  [0.20, 0.37], [0.21, 0.31], [0.22, 0.26], [0.21, 0.21],
  [0.23, 0.16], [0.26, 0.11], [0.29, 0.07], [0.33, 0.04],
  [0.37, 0.02], [0.41, 0.01],
]

const GREEN_DIM: RGB = { r: 34, g: 197, b: 94 }
const GREEN_BRIGHT: RGB = { r: 110, g: 231, b: 183 }

// Argentina = southern 62% of SA shape, left portion
const isArgentina = (nx: number, ny: number) => ny > 0.38 && nx < 0.56

// ─── Phase functions ──────────────────────────────────────────────────────────

function showMap(canvas: HTMLCanvasElement, pool: Particle[]) {
  const W = canvas.width, H = canvas.height, PAD = 25
  const saW = W * 0.34, saH = H - PAD * 2
  const saX = (W - saW) / 2, saY = PAD

  const off = document.createElement("canvas")
  off.width = W; off.height = H
  const ctx = off.getContext("2d")!
  ctx.fillStyle = "white"
  ctx.beginPath()
  SA.forEach(([nx, ny], i) => {
    const px = saX + nx * saW, py = saY + ny * saH
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fill()

  sampleOffscreen(off, canvas, pool, (x, y) => {
    const nx = (x - saX) / saW
    const ny = (y - saY) / saH
    return isArgentina(nx, ny) ? GREEN_BRIGHT : GREEN_DIM
  })
}

function zoomArgentina(canvas: HTMLCanvasElement, pool: Particle[]) {
  const W = canvas.width, H = canvas.height, PAD = 25
  const saW = W * 0.34, saH = H - PAD * 2
  const saX = (W - saW) / 2, saY = PAD

  const argXMin = saX + 0.20 * saW
  const argXMax = saX + 0.56 * saW
  const argYMin = saY + 0.38 * saH
  const argYMax = saY + saH

  const argW = argXMax - argXMin
  const argH = argYMax - argYMin
  const MARGIN = 50
  const scale = Math.min((W - MARGIN * 2) / argW, (H - MARGIN * 2) / argH)

  const zoomedW = argW * scale
  const zoomedH = argH * scale
  const originX = (W - zoomedW) / 2 - argXMin * scale
  const originY = (H - zoomedH) / 2 - argYMin * scale

  for (const p of pool) {
    if (p.isKilled) continue
    const tx = p.target.x, ty = p.target.y
    if (tx >= argXMin && tx <= argXMax && ty >= argYMin && ty <= argYMax) {
      p.target = { x: tx * scale + originX, y: ty * scale + originY }
    } else {
      p.kill(W, H)
    }
  }
}

function showText(canvas: HTMLCanvasElement, pool: Particle[]) {
  const W = canvas.width, H = canvas.height
  const off = document.createElement("canvas")
  off.width = W; off.height = H
  const ctx = off.getContext("2d")!
  ctx.fillStyle = "white"
  ctx.font = `155px "Bebas Neue", Impact, "Arial Black", sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("EFIFLET", W / 2, H / 2)

  sampleOffscreen(off, canvas, pool, () => GREEN_BRIGHT)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pool = useRef<Particle[]>([])
  const frame = useRef(0)
  const phase = useRef<"map" | "zoom" | "text">("map")

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = 1000
    canvas.height = 480

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

        if (frame.current === 300 && phase.current === "map") {
          phase.current = "zoom"
          zoomArgentina(canvas, pool.current)
        }
        if (frame.current === 560 && phase.current === "zoom") {
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
