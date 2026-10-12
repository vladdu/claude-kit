import type { EngineInterface, Register } from 'claude-code'

import type { ModelTier } from '../types'

const MODELS: Record<ModelTier, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
}

const RUBRIC = `You route the opening prompt of a coding assistant's conversation to a model tier; the conversation stays on that tier. Answer with one word: haiku, sonnet or opus.
haiku: trivial asks. Quick factual questions, a single shell command, renaming, small mechanical edits, formatting, "commit this".
sonnet: ordinary engineering. Implementing a feature, fixing a normal bug, writing tests, explaining code, moderate refactors.
opus: hard reasoning. Architecture or design decisions, subtle or cross-cutting bugs, concurrency, algorithms, proofs, large refactors, reviews of tricky code, ambiguous specs.
When unsure between two tiers, pick the higher one.`

const ENABLED_KEY = 'enabled'
const TIER = { plugin: 'model-router', key: 'tier' } as const

const isEnabled = async ($: EngineInterface) =>
  ((await $.store.get(ENABLED_KEY)) ?? true) === true

// The tier this conversation runs on, fixed at its first prompt; undefined for
// the session's own model. The on/off switch only matters at the next first prompt.
const activeTier = async ($: EngineInterface): Promise<ModelTier | undefined> => {
  const { value } = await $.state.get(TIER)
  return value === 'default' ? undefined : value
}

const showStatus = async ($: EngineInterface) => {
  const [tier, isOn] = await Promise.all([activeTier($), isEnabled($)])
  if (tier === undefined) {
    $.ui.status(isOn ? 'session' : 'off')
    return
  }
  $.ui.status(isOn ? tier : `${tier} (off next)`)
}

const pick = async ($: EngineInterface, text: string): Promise<ModelTier | undefined> => {
  const r = await $.model.complete({
    model: 'haiku',
    system: RUBRIC,
    prompt: `<prompt>\n${text.slice(0, 6000)}\n</prompt>\nTier:`,
    maxTokens: 5,
    effort: 'low',
    timeoutMs: 5000,
  })
  if (!r.isAnswered) return undefined
  const word = r.text.trim().toLowerCase().match(/haiku|sonnet|opus/)?.[0]
  return word as ModelTier | undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Automatic model routing: on, off, or toggle',
      argumentHint: '[on|off]',
      immediate: true,
    })
    await showStatus($)

    return next(e)
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const isOn = arg === 'on' ? true : arg === 'off' ? false : !(await isEnabled($))
    await $.store.set(ENABLED_KEY, isOn)
    await showStatus($)

    return { text: `Model router ${isOn ? 'on' : 'off'} from the next conversation (/clear).` }
  })

  // Pick only on a conversation's first prompt (new session or after /clear):
  // switching models later forfeits the prompt cache. For the same reason
  // /router takes effect at the next first prompt, not mid-conversation.
  on('prompt.submit', async ($, e, next) => {
    const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (!isTyped || e.turnId !== undefined || (await $.session.turns()) > 0) {
      return next(e)
    }
    const tier = (await isEnabled($)) ? await pick($, e.text).catch(() => undefined) : undefined
    await $.state.set(TIER, tier ?? 'default')
    await showStatus($)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const tier = e.agentId === undefined ? await activeTier($) : undefined
    if (tier === undefined) {
      return yield* next(e)
    }

    return yield* next({ ...e, model: MODELS[tier] })
  })
}
