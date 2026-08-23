import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { applyEnvMutations } from './run-unset-env.mjs'

describe('applyEnvMutations', () => {
  it('sets KEY=value tokens on the child env', () => {
    const env = applyEnvMutations({ PATH: '/bin' }, ['ELECTRON=1'])
    assert.equal(env.ELECTRON, '1')
    assert.equal(env.PATH, '/bin')
  })

  it('unsets tokens that have no equals sign', () => {
    const env = applyEnvMutations(
      { ELECTRON_RUN_AS_NODE: '1', PATH: '/bin' },
      ['ELECTRON_RUN_AS_NODE'],
    )
    assert.equal('ELECTRON_RUN_AS_NODE' in env, false)
    assert.equal(env.PATH, '/bin')
  })

  it('can set and unset in one pass so Windows and Unix share one runner', () => {
    const env = applyEnvMutations(
      { ELECTRON_RUN_AS_NODE: '1', PATH: '/bin' },
      ['ELECTRON_RUN_AS_NODE', 'ELECTRON=1'],
    )
    assert.equal('ELECTRON_RUN_AS_NODE' in env, false)
    assert.equal(env.ELECTRON, '1')
  })
})
