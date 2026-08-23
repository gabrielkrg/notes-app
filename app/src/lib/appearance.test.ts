import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  FONT_SIZES,
  PALETTES,
  applyFontSize,
  applyPalette,
  fontSizeCustomProperties,
  paletteCustomProperties,
  parseFontSize,
  parsePalette,
  titleBarOverlayForPalette,
} from './appearance.ts'
import { TITLE_BAR_HEIGHT, titleBarOverlay } from './title-bar.ts'

describe('parseFontSize', () => {
  it('defaults unknown or empty values to medium', () => {
    assert.equal(parseFontSize(null), 'medium')
    assert.equal(parseFontSize(''), 'medium')
    assert.equal(parseFontSize('huge'), 'medium')
  })

  it('accepts each base size id', () => {
    for (const size of FONT_SIZES) {
      assert.equal(parseFontSize(size.id), size.id)
    }
  })
})

describe('fontSizeCustomProperties', () => {
  it('maps each size to a distinct pixel base', () => {
    const small = fontSizeCustomProperties('small')
    const medium = fontSizeCustomProperties('medium')
    const large = fontSizeCustomProperties('large')
    assert.equal(small['--font-size-base'], '16px')
    assert.equal(medium['--font-size-base'], '18px')
    assert.equal(large['--font-size-base'], '21px')
  })
})

describe('applyFontSize', () => {
  it('writes the base size token onto a style target', () => {
    const set = new Map<string, string>()
    const target = {
      style: {
        setProperty(name: string, value: string) {
          set.set(name, value)
        },
      },
      dataset: {} as Record<string, string>,
    }

    applyFontSize('large', target)
    assert.equal(set.get('--font-size-base'), '21px')
    assert.equal(target.dataset.fontSize, 'large')
  })
})

describe('PALETTES', () => {
  it('names a typeface for each theme, not just a color', () => {
    assert.equal(PALETTES.length, 3)
    const faces = PALETTES.map((palette) => palette.faces)
    assert.deepEqual(faces, ['Grotesk + Merriweather', 'Literata', 'Mono + Grotesk'])
    assert.equal(new Set(faces).size, faces.length)
  })
})

describe('parsePalette', () => {
  it('defaults unknown or empty values to ink', () => {
    assert.equal(parsePalette(null), 'ink')
    assert.equal(parsePalette(''), 'ink')
    assert.equal(parsePalette('neon'), 'ink')
  })

  it('accepts each palette id', () => {
    for (const palette of PALETTES) {
      assert.equal(parsePalette(palette.id), palette.id)
    }
  })
})

describe('paletteCustomProperties', () => {
  it('gives each theme a distinct type stack', () => {
    const ink = paletteCustomProperties('ink')
    const sepia = paletteCustomProperties('sepia')
    const forest = paletteCustomProperties('forest')
    assert.match(ink['--font-sans'], /space-grotesk/)
    assert.match(ink['--font-heading'], /merriweather/)
    assert.match(sepia['--font-sans'], /literata/)
    assert.match(sepia['--font-heading'], /literata/)
    assert.match(forest['--font-sans'], /jetbrains-mono/)
    assert.match(forest['--font-heading'], /space-grotesk/)
  })
})

describe('applyPalette', () => {
  it('records the palette and its fonts on a style target', () => {
    const set = new Map<string, string>()
    const target = {
      style: {
        setProperty(name: string, value: string) {
          set.set(name, value)
        },
      },
      dataset: {} as Record<string, string>,
    }

    applyPalette('sepia', target)
    assert.equal(target.dataset.palette, 'sepia')
    assert.equal(set.get('--font-sans'), paletteCustomProperties('sepia')['--font-sans'])
    assert.equal(set.get('--font-heading'), paletteCustomProperties('sepia')['--font-heading'])
  })
})

describe('titleBarOverlayForPalette', () => {
  it('keeps the default ink chrome', () => {
    assert.deepEqual(titleBarOverlayForPalette('ink', true), titleBarOverlay(true))
    assert.deepEqual(titleBarOverlayForPalette('ink', false), titleBarOverlay(false))
  })

  it('uses distinct hex chrome for sepia and forest', () => {
    const sepiaLight = titleBarOverlayForPalette('sepia', false)
    const forestDark = titleBarOverlayForPalette('forest', true)
    assert.notEqual(sepiaLight.color, titleBarOverlay(false).color)
    assert.notEqual(forestDark.color, titleBarOverlay(true).color)
    assert.match(sepiaLight.color, /^#[0-9a-f]{6}$/i)
    assert.match(forestDark.symbolColor, /^#[0-9a-f]{6}$/i)
    assert.equal(sepiaLight.height, TITLE_BAR_HEIGHT)
  })
})
