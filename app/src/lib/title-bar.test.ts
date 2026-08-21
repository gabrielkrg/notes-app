import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  TITLE_BAR_HEIGHT,
  desktopWindowChrome,
  isHexColor,
  needsCustomWindowButtons,
  overlayFromCssColors,
  parseCssRgb,
  rgbToHex,
  titleBarOverlay,
} from './title-bar.ts'

describe('titleBarOverlay', () => {
  it('uses dark chrome colors at the shared title-bar height', () => {
    assert.deepEqual(titleBarOverlay(true), {
      color: '#252525',
      symbolColor: '#fafafa',
      height: TITLE_BAR_HEIGHT,
    })
  })

  it('uses light chrome colors at the shared title-bar height', () => {
    assert.deepEqual(titleBarOverlay(false), {
      color: '#ffffff',
      symbolColor: '#262626',
      height: TITLE_BAR_HEIGHT,
    })
  })
})

describe('parseCssRgb', () => {
  it('parses comma-separated rgb()', () => {
    assert.deepEqual(parseCssRgb('rgb(37, 37, 37)'), { r: 37, g: 37, b: 37 })
  })

  it('parses space-separated rgb() and rgba()', () => {
    assert.deepEqual(parseCssRgb('rgb(250 250 250)'), { r: 250, g: 250, b: 250 })
    assert.deepEqual(parseCssRgb('rgba(38, 38, 38, 0.9)'), { r: 38, g: 38, b: 38 })
  })

  it('returns null for non-rgb colors', () => {
    assert.equal(parseCssRgb('oklch(0.145 0 0)'), null)
    assert.equal(parseCssRgb(''), null)
  })
})

describe('rgbToHex', () => {
  it('formats clamped 8-bit channels', () => {
    assert.equal(rgbToHex(37, 37, 37), '#252525')
    assert.equal(rgbToHex(255.4, -1, 300), '#ff00ff')
  })
})

describe('overlayFromCssColors', () => {
  it('converts computed rgb colors into an overlay', () => {
    assert.deepEqual(
      overlayFromCssColors('rgb(255, 255, 255)', 'rgb(38, 38, 38)'),
      {
        color: '#ffffff',
        symbolColor: '#262626',
        height: TITLE_BAR_HEIGHT,
      },
    )
  })

  it('falls back to dark overlay when colors cannot be parsed', () => {
    assert.deepEqual(overlayFromCssColors('oklch(1 0 0)', 'black'), titleBarOverlay(true))
  })
})

describe('isHexColor', () => {
  it('accepts 6-digit hex colors', () => {
    assert.equal(isHexColor('#252525'), true)
    assert.equal(isHexColor('#FFFFFF'), true)
    assert.equal(isHexColor('#fff'), false)
    assert.equal(isHexColor('rgb(1, 2, 3)'), false)
    assert.equal(isHexColor(null), false)
  })
})

describe('desktopWindowChrome', () => {
  it('keeps macOS traffic lights in a hidden inset title bar', () => {
    assert.deepEqual(desktopWindowChrome('darwin', true), {
      frame: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 18 },
    })
  })

  it('removes the GNOME frame on Linux so the app can draw one bar', () => {
    assert.deepEqual(desktopWindowChrome('linux', true), {
      frame: false,
      titleBarStyle: 'hidden',
    })
  })

  it('uses a hidden title bar with native overlay controls on Windows', () => {
    assert.deepEqual(desktopWindowChrome('win32', false), {
      frame: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: titleBarOverlay(false),
    })
  })
})

describe('needsCustomWindowButtons', () => {
  it('is false in the browser and on macOS', () => {
    assert.equal(needsCustomWindowButtons(undefined, false), false)
    assert.equal(needsCustomWindowButtons('darwin', false), false)
  })

  it('is always true on Linux where the native overlay is skipped', () => {
    assert.equal(needsCustomWindowButtons('linux', true), true)
    assert.equal(needsCustomWindowButtons('linux', false), true)
  })

  it('is a Windows fallback when the overlay is not visible', () => {
    assert.equal(needsCustomWindowButtons('win32', true), false)
    assert.equal(needsCustomWindowButtons('win32', false), true)
  })
})
