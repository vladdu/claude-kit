import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const composer = { kind: 'composer' } as const
const SESSION_MODEL = 'claude-fable-5-1'

const setup = (on: On, answer: string | Error) => {
  let turns = 0
  const seen: string[] = []
  const classified: string[] = []
  const shown: (string | undefined)[] = []
  on('model.complete', ($, e) => {
    classified.push(e.prompt)
    if (answer instanceof Error) throw answer
    return { value: { isAnswered: true, text: answer, usage: { input_tokens: 1, output_tokens: 1 } } } as never
  })
  on('session.turns', () => ({ value: turns }) as never)
  on('ui.status', ($, e) => {
    shown.push(e.text)
    return { value: undefined } as never
  })
  on('session.model', () => ({ value: SESSION_MODEL }) as never)
  on('prompt.submit', ($, e) => {
    turns += 1
    return { text: e.text }
  })
  on('turn.step', async function* ($, e) {
    seen.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  const clear = () => {
    turns = 0
  }
  return { seen, classified, shown, clear }
}

const run = async ($: Engine, text: string, agentId?: string) => {
  await $.prompt.submit({ text, wait: false, origin: composer })
  const step = { turnId: 't', index: 0, model: SESSION_MODEL, messageCount: 1 }
  for await (const _ of $.turn.step(agentId ? { ...step, agentId } : step)) void _
}

test('picks on the first prompt and keeps the tier for later turns', async ($, on) => {
  mock.store(on)
  const { seen, classified } = setup(on, 'opus')
  await run($, 'Design the scheduler')
  await run($, 'now rename foo to bar')
  expect(seen).toEqual(['claude-opus-5-5', 'claude-opus-5-5'])
  expect(classified.length).toBe(1)
})

test('picks again after /clear', async ($, on) => {
  mock.store(on)
  const s = setup(on, ' Haiku.')
  await run($, 'run git status')
  s.clear()
  await run($, 'another trivial one')
  expect(s.classified.length).toBe(2)
  expect(s.seen).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5'])
})

test('subagents keep their own model', async ($, on) => {
  mock.store(on)
  const { seen } = setup(on, 'opus')
  await run($, 'Design the scheduler', 'agent-1')
  expect(seen).toEqual([SESSION_MODEL])
})

test('off at the first prompt keeps the session model for the conversation', async ($, on) => {
  mock.store(on)
  const { seen, classified } = setup(on, 'opus')
  const r = await $.command.run({ command: 'router', args: 'off', origin: composer } as never)
  expect(r.text).toBe('Model router off from the next conversation (/clear).')
  await run($, 'Design the scheduler')
  await $.command.run({ command: 'router', args: 'on', origin: composer } as never)
  await run($, 'more')
  expect(seen).toEqual([SESSION_MODEL, SESSION_MODEL])
  expect(classified.length).toBe(0)
})

test('an unparseable verdict keeps the session model', async ($, on) => {
  mock.store(on)
  const { seen } = setup(on, 'banana')
  await run($, 'hello')
  expect(seen).toEqual([SESSION_MODEL])
})

test('status line names the chosen model', async ($, on) => {
  mock.store(on)
  const { shown } = setup(on, 'opus')
  await run($, 'Design the scheduler')
  expect(shown.at(-1)).toBe('opus')
})

test('status line says session when no tier is picked', async ($, on) => {
  mock.store(on)
  const { shown } = setup(on, 'banana')
  await run($, 'hello')
  expect(shown.at(-1)).toBe('session')
})

const router = ($: Engine, args: string) =>
  $.command.run({ command: 'router', args, origin: composer } as never) as Promise<{ text: string }>

test('off mid-conversation keeps the tier until /clear', async ($, on) => {
  mock.store(on)
  const s = setup(on, 'opus')
  await run($, 'Design the scheduler')
  await router($, 'off')
  expect(s.shown.at(-1)).toBe('opus (off next)')
  await run($, 'more')
  s.clear()
  await run($, 'fresh conversation')
  expect(s.seen).toEqual(['claude-opus-5-5', 'claude-opus-5-5', SESSION_MODEL])
  expect(s.classified.length).toBe(1)
  expect(s.shown.at(-1)).toBe('off')
})

test('no argument toggles the switch', async ($, on) => {
  mock.store(on)
  const { shown } = setup(on, 'opus')
  expect((await router($, '')).text).toBe('Model router off from the next conversation (/clear).')
  expect(shown.at(-1)).toBe('off')
  expect((await router($, '')).text).toBe('Model router on from the next conversation (/clear).')
  expect(shown.at(-1)).toBe('session')
})

test('a failing classifier keeps the session model', async ($, on) => {
  mock.store(on)
  const { seen, shown } = setup(on, new Error('timeout'))
  await run($, 'Design the scheduler')
  expect(seen).toEqual([SESSION_MODEL])
  expect(shown.at(-1)).toBe('session')
})
