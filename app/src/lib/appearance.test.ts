import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  FONT_SIZES,
  TYPEFACES,
  applyFontSize,
  applyTypeface,
  fontSizeCustomProperties,
  parseFontSize,
  parseTypeface,
  typefaceCustomProperties,
} from './appearance.ts'

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

describe('TYPEFACES', () => {
  it('keeps the six theme stacks and adds four more', () => {
    assert.equal(TYPEFACES.length, 10)
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
      'JetBrains Mono',
      'Newsreader + Plex',
    ])
    assert.equal(new Set(faces).size, faces.length)
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
