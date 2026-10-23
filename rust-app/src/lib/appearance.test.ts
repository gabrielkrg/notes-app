import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  FONT_SIZES,
  PALETTES,
  TYPEFACES,
  applyFontSize,
  applyPalette,
  applyTypeface,
  fontSizeCustomProperties,
  paletteCustomProperties,
  parseFontSize,
  parsePalette,
  parseTypeface,
  titleBarOverlayForPalette,
  typefaceCustomProperties,
  typefaceForPalette,
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
  it('pairs each theme with a default typeface', () => {
    assert.equal(PALETTES.length, 7)
    assert.deepEqual(
      PALETTES.map((palette) => palette.typeface),
      [
        'grotesk-merriweather',
        'literata',
        'mono-grotesk',
        'grotesk',
        'literata-grotesk',
        'merriweather-mono',
        'mono-grotesk',
      ],
    )
  })
})

describe('TYPEFACES', () => {
  it('keeps the six theme stacks and adds three more', () => {
    assert.equal(TYPEFACES.length, 9)
    const faces = TYPEFACES.map((typeface) => typeface.faces)
    assert.deepEqual(faces, [
      'Grotesk + Merriweather',
      'Literata',
      'Mono + Grotesk',
      'Grotesk',
      'Literata + Grotesk',
      'Merriweather + Mono',
      'IBM Plex Sans',
      'Source Serif',
      'Newsreader + Plex',
    ])
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

describe('parseTypeface', () => {
  it('defaults unknown or empty values to grotesk-merriweather', () => {
    assert.equal(parseTypeface(null), 'grotesk-merriweather')
    assert.equal(parseTypeface(''), 'grotesk-merriweather')
    assert.equal(parseTypeface('comic-sans'), 'grotesk-merriweather')
  })

  it('accepts each typeface id', () => {
    for (const typeface of TYPEFACES) {
      assert.equal(parseTypeface(typeface.id), typeface.id)
    }
  })
})

describe('typefaceForPalette', () => {
  it('returns the stack that a theme click should apply', () => {
    assert.equal(typefaceForPalette('ink'), 'grotesk-merriweather')
    assert.equal(typefaceForPalette('sepia'), 'literata')
    assert.equal(typefaceForPalette('forest'), 'mono-grotesk')
    assert.equal(typefaceForPalette('slate'), 'grotesk')
    assert.equal(typefaceForPalette('dusk'), 'literata-grotesk')
    assert.equal(typefaceForPalette('midnight'), 'merriweather-mono')
  })
})

describe('paletteCustomProperties', () => {
  it('gives each theme a distinct type stack', () => {
    const ink = paletteCustomProperties('ink')
    const sepia = paletteCustomProperties('sepia')
    const forest = paletteCustomProperties('forest')
    const slate = paletteCustomProperties('slate')
    const dusk = paletteCustomProperties('dusk')
    const midnight = paletteCustomProperties('midnight')
    assert.match(ink['--font-sans'], /space-grotesk/)
    assert.match(ink['--font-heading'], /merriweather/)
    assert.match(sepia['--font-sans'], /literata/)
    assert.match(sepia['--font-heading'], /literata/)
    assert.match(forest['--font-sans'], /jetbrains-mono/)
    assert.match(forest['--font-heading'], /space-grotesk/)
    assert.match(slate['--font-sans'], /space-grotesk/)
    assert.match(slate['--font-heading'], /space-grotesk/)
    assert.match(dusk['--font-sans'], /literata/)
    assert.match(dusk['--font-heading'], /space-grotesk/)
    assert.match(midnight['--font-sans'], /merriweather/)
    assert.match(midnight['--font-heading'], /jetbrains-mono/)
  })
})

describe('typefaceCustomProperties', () => {
  it('adds plex, source, and news stacks on top of the theme pairings', () => {
    const plex = typefaceCustomProperties('plex')
    const source = typefaceCustomProperties('source')
    const news = typefaceCustomProperties('news')
    assert.match(plex['--font-sans'], /ibm-plex-sans/)
    assert.match(plex['--font-heading'], /ibm-plex-sans/)
    assert.match(source['--font-sans'], /source-serif/)
    assert.match(source['--font-heading'], /source-serif/)
    assert.match(news['--font-sans'], /newsreader/)
    assert.match(news['--font-heading'], /ibm-plex-sans/)
  })
})

describe('applyPalette', () => {
  it('records the palette without changing fonts', () => {
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
    assert.equal(set.has('--font-sans'), false)
    assert.equal(set.has('--font-heading'), false)
  })
})

describe('applyTypeface', () => {
  it('records the typeface and its fonts on a style target', () => {
    const set = new Map<string, string>()
    const target = {
      style: {
        setProperty(name: string, value: string) {
          set.set(name, value)
        },
      },
      dataset: {} as Record<string, string>,
    }

    applyTypeface('literata', target)
    assert.equal(target.dataset.typeface, 'literata')
    assert.equal(set.get('--font-sans'), typefaceCustomProperties('literata')['--font-sans'])
    assert.equal(set.get('--font-heading'), typefaceCustomProperties('literata')['--font-heading'])
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

  it('uses distinct hex chrome for slate, dusk, and midnight', () => {
    const inkDark = titleBarOverlay(true)
    const slateLight = titleBarOverlayForPalette('slate', false)
    const duskDark = titleBarOverlayForPalette('dusk', true)
    const midnightDark = titleBarOverlayForPalette('midnight', true)
    assert.notEqual(slateLight.color, titleBarOverlay(false).color)
    assert.notEqual(duskDark.color, inkDark.color)
    assert.notEqual(midnightDark.color, inkDark.color)
    assert.notEqual(duskDark.color, midnightDark.color)
    assert.match(slateLight.color, /^#[0-9a-f]{6}$/i)
    assert.match(duskDark.symbolColor, /^#[0-9a-f]{6}$/i)
    assert.match(midnightDark.color, /^#[0-9a-f]{6}$/i)
    assert.equal(midnightDark.height, TITLE_BAR_HEIGHT)
  })
})
