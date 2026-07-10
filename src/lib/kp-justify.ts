/**
 * Knuth-Plass optimal line-breaking algorithm.
 *
 * Ported from obsidian-pretext, which itself was ported from the Pretext
 * justification-comparison demo (github.com/chenglou/pretext).
 *
 * The algorithm enumerates all feasible break positions (word boundaries
 * and soft hyphens), builds a graph with edges weighted by a "badness"
 * cost function, and finds the shortest path through the DP recurrence:
 *   dp[j] = min over i<j of dp[i] + badness(i, j)
 *
 * The badness function combines:
 *   - Cubic stretch/shrink ratio
 *   - River penalty (when spaces exceed 150% of normal)
 *   - Tight spacing penalty (when spaces are below 65% of normal)
 *   - Hyphen penalty (small constant)
 */

import type { BreakCandidate, JustifiedLine, JustifiedSegment } from "./kp-types"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CJK_BREAK_RE =
  /[\u{4E00}-\u{9FFF}\u{3400}-\u{4DBF}\u{F900}-\u{FAFF}\u{3000}-\u{303F}\u{3040}-\u{309F}\u{30A0}-\u{30FF}\u{AC00}-\u{D7AF}]/u

// ---------------------------------------------------------------------------
// Break candidate enumeration
// ---------------------------------------------------------------------------

export function enumerateBreakCandidates(
  segments: string[],
): BreakCandidate[] {
  const candidates: BreakCandidate[] = [{ segIndex: 0, isSoftHyphen: false }]
  const n = segments.length

  for (let i = 0; i < n; i++) {
    const text = segments[i]
    if (!text) continue

    if (text === "­") {
      // Soft hyphen: break is possible after this segment
      if (i + 1 < n) {
        candidates.push({ segIndex: i + 1, isSoftHyphen: true })
      }
    } else if (text.trim().length === 0 && i + 1 < n) {
      // Space: break after the space
      candidates.push({ segIndex: i + 1, isSoftHyphen: false })
    } else if (i + 1 < n && CJK_BREAK_RE.test(text)) {
      candidates.push({ segIndex: i + 1, isSoftHyphen: false })
    }
  }

  // Sentinel: end of paragraph
  candidates.push({ segIndex: n, isSoftHyphen: false })
  return candidates
}

// ---------------------------------------------------------------------------
// Line info
// ---------------------------------------------------------------------------

interface LineInfo {
  wordWidth: number
  spaceCount: number
  endsWithHyphen: boolean
}

function getLineInfo(
  fromIdx: number,
  toIdx: number,
  candidates: BreakCandidate[],
  segments: string[],
  widths: number[],
  hyphenWidth: number,
): LineInfo {
  const from = candidates[fromIdx].segIndex
  const to = candidates[toIdx].segIndex
  const endsWithHyphen = candidates[toIdx].isSoftHyphen

  let wordWidth = 0
  let spaceCount = 0

  for (let si = from; si < to; si++) {
    const text = segments[si]
    if (!text) continue
    if (text === "­") continue // soft hyphens: zero width

    if (text.trim().length === 0) {
      spaceCount++
    } else {
      wordWidth += widths[si]
    }
  }

  // Trailing space doesn't contribute to justification
  if (to > from) {
    const lastSeg = segments[to - 1]
    if (lastSeg && lastSeg.trim().length === 0) {
      spaceCount--
    }
  }

  // Add hyphen width if break is at a soft hyphen
  if (endsWithHyphen) {
    wordWidth += hyphenWidth
  }

  return { wordWidth, spaceCount, endsWithHyphen }
}

// ---------------------------------------------------------------------------
// Badness function
// ---------------------------------------------------------------------------

const INF = 1e8

function lineBadness(
  info: LineInfo,
  isLastLine: boolean,
  maxWidth: number,
  normalSpaceWidth: number,
  minSpacingRatio: number,
  tightThreshold: number,
): number {
  // Last line: left-aligned (not justified). Penalise overflow.
  if (isLastLine) {
    if (info.wordWidth > maxWidth) return INF
    if (info.spaceCount === 0) return 0

    const naturalWidth = info.wordWidth + info.spaceCount * normalSpaceWidth
    if (naturalWidth <= maxWidth) return 0

    // Must squeeze to fit
    const usedSpace = (maxWidth - info.wordWidth) / info.spaceCount
    const ratio = (normalSpaceWidth - usedSpace) / normalSpaceWidth
    return ratio * ratio * 100
  }

  // No spaces (single word)
  if (info.spaceCount <= 0) {
    const slack = maxWidth - info.wordWidth
    if (slack < 0) return INF
    return slack * slack * 10
  }

  const justifiedSpace = (maxWidth - info.wordWidth) / info.spaceCount
  if (justifiedSpace < 0) return INF

  // Reject if spaces would be narrower than minSpacingRatio
  if (justifiedSpace < normalSpaceWidth * minSpacingRatio) return INF

  // Core badness: cube of deviation
  const ratio = (justifiedSpace - normalSpaceWidth) / normalSpaceWidth
  const absRatio = Math.abs(ratio)
  const badness = absRatio * absRatio * absRatio * 1000

  // River penalty: spaces exceed 150% of normal
  const riverExcess = justifiedSpace / normalSpaceWidth - 1.5
  const riverPenalty =
    riverExcess > 0 ? 5000 + riverExcess * riverExcess * 10000 : 0

  // Tight penalty
  const aTightThreshold = normalSpaceWidth * tightThreshold
  const tightPenalty =
    justifiedSpace < aTightThreshold
      ? 3000 +
        (aTightThreshold - justifiedSpace) *
          (aTightThreshold - justifiedSpace) *
          10000
      : 0

  // Hyphen penalty
  const hyphenPenalty = info.endsWithHyphen ? 50 : 0

  return badness + riverPenalty + tightPenalty + hyphenPenalty
}

// ---------------------------------------------------------------------------
// Optimal layout (Knuth-Plass DP)
// ---------------------------------------------------------------------------

export interface OptimalLayoutOptions {
  segments: string[]
  widths: number[]
  maxWidth: number
  normalSpaceWidth: number
  hyphenWidth: number
  minSpacingRatio?: number
  tightThreshold?: number
}

/**
 * Compute the optimal line breaks for a paragraph using the Knuth-Plass
 * dynamic programming algorithm.
 */
export function computeOptimalLayout(
  options: OptimalLayoutOptions,
): JustifiedLine[] {
  const {
    segments,
    widths,
    maxWidth,
    normalSpaceWidth,
    hyphenWidth,
    minSpacingRatio = 0.5,
    tightThreshold = 0.75,
  } = options

  const n = segments.length
  if (n === 0) return []

  const candidates = enumerateBreakCandidates(segments)
  const numCandidates = candidates.length

  // ----- DP: shortest path -----
  const dp = new Float64Array(numCandidates).fill(Infinity)
  const prev = new Int32Array(numCandidates).fill(-1)
  dp[0] = 0

  for (let j = 1; j < numCandidates; j++) {
    const isLast = j === numCandidates - 1

    for (let i = j - 1; i >= 0; i--) {
      if (dp[i] === Infinity) continue

      const info = getLineInfo(i, j, candidates, segments, widths, hyphenWidth)

      // Pruning: if natural width exceeds 2× maxWidth, earlier starts only
      // add more words → never feasible
      const totalWidth = info.wordWidth + info.spaceCount * normalSpaceWidth
      if (totalWidth > maxWidth * 2) break

      const bad = lineBadness(
        info,
        isLast,
        maxWidth,
        normalSpaceWidth,
        minSpacingRatio,
        tightThreshold,
      )
      const total = dp[i] + bad
      if (total < dp[j]) {
        dp[j] = total
        prev[j] = i
      }
    }
  }

  // ----- Backtrace -----
  const breakIndices: number[] = []
  let cur = numCandidates - 1
  while (cur > 0) {
    if (prev[cur] === -1) {
      cur--
      continue
    }
    breakIndices.push(cur)
    cur = prev[cur]
  }
  breakIndices.reverse()

  // ----- Build lines -----
  const lines: JustifiedLine[] = []
  let fromCandidate = 0

  for (let bi = 0; bi < breakIndices.length; bi++) {
    const toCandidate = breakIndices[bi]
    const from = candidates[fromCandidate].segIndex
    const to = candidates[toCandidate].segIndex
    const endsWithHyphen = candidates[toCandidate].isSoftHyphen
    const isLast = toCandidate === numCandidates - 1

    const lineSegments: JustifiedSegment[] = []
    for (let si = from; si < to; si++) {
      const text = segments[si]
      if (!text) continue
      if (text === "­") continue

      const width = widths[si]
      const isSpace = text.trim().length === 0
      lineSegments.push({ text, width, isSpace })
    }

    // Append visible hyphen
    if (endsWithHyphen) {
      lineSegments.push({ text: "-", width: hyphenWidth, isSpace: false })
    }

    // Strip trailing spaces
    while (
      lineSegments.length > 0 &&
      lineSegments[lineSegments.length - 1].isSpace
    ) {
      lineSegments.pop()
    }

    // Compute line width
    let lineWidth = 0
    for (const seg of lineSegments) {
      lineWidth += seg.width
    }

    lines.push({
      segments: lineSegments,
      lineWidth,
      maxWidth,
      isLast,
      endsWithHyphen,
      fromSegIndex: from,
      toSegIndex: to,
    })

    fromCandidate = toCandidate
  }

  return lines
}

/** Compute the word-spacing value to apply to a justified line. */
export function computeWordSpacing(
  line: JustifiedLine,
  normalSpaceWidth: number,
  minSpacingRatio: number,
): number | undefined {
  const spaces = line.segments.filter((s) => s.isSpace)
  if (spaces.length === 0) return undefined

  const wordWidth = line.segments.reduce(
    (sum, s) => (s.isSpace ? sum : sum + s.width),
    0,
  )

  if (line.isLast) {
    // Last line: left-aligned, squeeze only if overflow
    const naturalWidth = wordWidth + spaces.length * normalSpaceWidth
    const overflow = naturalWidth - line.maxWidth
    if (overflow > 0.5) {
      const minSpace = normalSpaceWidth * minSpacingRatio
      const squeezePerGap = overflow / spaces.length
      const targetSpace = normalSpaceWidth - squeezePerGap
      const clamped = Math.max(minSpace, targetSpace)
      const ws = clamped - normalSpaceWidth
      if (Math.abs(ws) > 0.01) return ws
    }
    return undefined
  }

  // Non-last lines: fully justified
  let justifiedSpace = (line.maxWidth - wordWidth) / spaces.length
  if (justifiedSpace < normalSpaceWidth * minSpacingRatio) {
    justifiedSpace = normalSpaceWidth * minSpacingRatio
  }
  const ws = justifiedSpace - normalSpaceWidth
  return Math.abs(ws) > 0.01 ? ws : undefined
}
