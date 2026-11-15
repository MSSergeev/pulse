import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// 2026-10-14 11:32:05 UTC is a Wednesday; the machine is at UTC+3.
const ROW = '2f836e48-04ed-4753-b7b3-259ce359e6ef'
// How Claude Code sometimes names the drawn block of the same row.
const DRAWN = '2f836e48-04ed-4753-b7b3-000000000000'
const NARRATION = '4f6289c9-4dea-4395-b466-22a386f11e8b'
const NOW = Date.UTC(2026, 9, 14, 11, 32, 5)

const CONTEXT = { tokens: 169_000, window: 1_000_000, percent: 17 }
const LIMITS = [
  { kind: 'five_hour', percentUsed: 31, resetsAt: '2026-10-14T15:00:00Z' },
  { kind: 'seven_day', percentUsed: 45, resetsAt: '2026-10-17T10:00:00Z' },
]
const BREAKDOWN = {
  categories: [
    { name: 'Messages', tokens: 120_000, color: 'suggestion', isDeferred: false, kind: 'used' as const },
    { name: 'Free space', tokens: 800_000, color: 'inactive', isDeferred: false, kind: 'free' as const },
  ],
  totalTokens: 169_000,
  maxTokens: 1_000_000,
  rawMaxTokens: 1_000_000,
  autocompactSource: 'model-default' as const,
  percentage: 17,
  gridRows: [],
  model: 'Opus 5.5',
  memoryFiles: [],
  mcpTools: [],
  agents: [],
  isAutoCompactEnabled: false,
  apiUsage: null,
}

function world(on: On) {
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('process.run', ($, e) => {
    const stdout = e.argv[0] === 'date' ? '+0300\n' : '{"total": [142, 80763, 10102549, 194292], "by": [["@main", 3], ["general-purpose", 1]]}\n'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'sid' }))
  on('session.usage', ($, e) => ({
    value: {
      startedAt: NOW,
      context: e?.breakdown === undefined ? CONTEXT : { ...CONTEXT, breakdown: BREAKDOWN },
      rateLimits: LIMITS,
      cost: { usd: 1.5 },
    },
  }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.status', () => ({ value: undefined }))
  // Standing in for the engine: its own drawing.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: e.component })
  })
}

const RU = { options: { language: 'ru' } }

test('the last reply of a turn shows its time, a press shows the date and context', RU, async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const uuid of [NARRATION, ROW]) {
    await $.session.append({
      door: 'response',
      uuid,
      origin: { kind: 'model', model: 'm' },
      message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: uuid }] },
    })
  }
  await $.turn.complete({ answer: ROW, durationMs: 72_000, isAborted: false, turnId: 't1', reason: 'answer' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const props = { text: 'ответ', isFirstOfReply: true }
    const reply = await $.ui.mount({ plugin: 'pulse', surface, component: 'AssistantMessage', props, requestId: DRAWN })
    expect((await reply.find({ key: 'time' }))?.text).toBe('◷ 14:32')
    await reply.press({ key: 'time' })
    expect((await reply.find({ key: 'time' }))?.text).toBe('◷ 14:32:05 · ср, 14 окт · отвечал 1 мин 12 с · контекст 17%')
    await reply.press({ key: 'time' })
    expect((await reply.find({ key: 'time' }))?.text).toBe('◷ 14:32')
    await reply.unmount()

    const narration = await $.ui.mount({ plugin: 'pulse', surface, component: 'AssistantMessage', props, requestId: NARRATION })
    expect(await narration.find({ key: 'time' })).toBeUndefined()
    await narration.unmount()
  }
})

test('the ring opens the usage pane, which breaks the context down', RU, async ($, on) => {
  world(on)
  const opened: string[] = []
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const footer = await $.ui.mount({ plugin: 'pulse', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect((await footer.find({ key: 'usage' }))?.text).toBe('◔ 17%')
  await footer.press({ key: 'usage' })
  expect(opened).toEqual(['usage'])

  const pane = await $.ui.mount({
    plugin: 'pulse',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'usage',
    props: {
      title: 'Расход',
      isFocused: false,
      bodyColumns: 40,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })
  expect(await pane.find({ text: 'сброс в 18:00 · через 3 ч 28 мин' })).toBeDefined()
  expect(await pane.find({ text: 'сброс сб 13:00 · через 2 д 22 ч 28 мин' })).toBeDefined()
  expect((await pane.drawn()).type).toBe('Box')
  expect(await pane.find({ text: /Messages/ })).toBeUndefined()
  await pane.press({ key: 'context' })
  expect(await pane.find({ text: /Messages/ })).toBeDefined()
  expect(await pane.find({ text: /120k\s+12\.0%/ })).toBeDefined()
  await pane.press({ key: 'tokens' })
  expect(await pane.find({ text: '10.1M' })).toBeDefined()
  expect(await pane.find({ text: '80.8k' })).toBeDefined()
  await pane.press({ key: 'sources' })
  expect(await pane.find({ text: 'general-purpose' })).toBeDefined()
  expect(await pane.find({ text: '75%' })).toBeDefined()
  expect(await pane.find({ text: 'основной диалог' })).toBeDefined()
})

// The reply from the first test: time, date, duration and context in each language.
async function chip($: Parameters<Parameters<typeof test>[1]>[0]) {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.append({
    door: 'response',
    uuid: ROW,
    origin: { kind: 'model', model: 'm' },
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'x' }] },
  })
  await $.turn.complete({ answer: ROW, durationMs: 72_000, isAborted: false, turnId: 't1', reason: 'answer' })
  const reply = await $.ui.mount({
    plugin: 'pulse',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: 'x', isFirstOfReply: true },
    requestId: ROW,
  })
  await reply.press({ key: 'time' })
  const text = (await reply.find({ key: 'time' }))?.text
  await reply.unmount()
  return text
}

const CHIPS = {
  en: '◷ 14:32:05 · Wed, Oct 14 · answered in 1 min 12 s · context 17%',
  es: '◷ 14:32:05 · mié, 14 oct · respondió en 1 min 12 s · contexto 17%',
  fr: '◷ 14:32:05 · mer. 14 oct. · réponse en 1 min 12 s · contexte 17 %',
  ru: '◷ 14:32:05 · ср, 14 окт · отвечал 1 мин 12 с · контекст 17%',
} as const

for (const [language, expected] of Object.entries(CHIPS)) {
  test(`the chip speaks ${language} when it is chosen`, { options: { language } }, async ($, on) => {
    world(on)
    expect(await chip($)).toBe(expected)
  })
}

test('auto takes Claude Code’s language setting first', async ($, on) => {
  world(on)
  on('settings.read', () => ({ value: { language: 'Español' } }))
  on('env.get', () => ({ value: 'fr_FR.UTF-8' }))
  expect(await chip($)).toBe(CHIPS.es)
})

test('auto falls back to the system locale', async ($, on) => {
  world(on)
  on('settings.read', () => ({ value: {} }))
  on('env.get', ($, e) => ({ value: e.name === 'LANG' ? 'fr_FR.UTF-8' : undefined }))
  expect(await chip($)).toBe(CHIPS.fr)
})

test('auto is English when nothing names a language', async ($, on) => {
  world(on)
  on('settings.read', () => ({ value: {} }))
  on('env.get', ($, e) => ({ value: e.name === 'LANG' ? 'C.UTF-8' : undefined }))
  expect(await chip($)).toBe(CHIPS.en)
})

test('the pane is English when English is chosen', { options: { language: 'en' } }, async ($, on) => {
  world(on)
  on('ui.panes', () => ({ value: [] }))
  const titles: string[] = []
  on('ui.open', ($, e) => {
    titles.push(e.title ?? '')
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const footer = await $.ui.mount({ plugin: 'pulse', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  await footer.press({ key: 'usage' })
  expect(titles).toEqual(['Usage'])

  const pane = await $.ui.mount({
    plugin: 'pulse',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'usage',
    props: { title: 'Usage', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  expect(await pane.find({ text: 'Subscription limits' })).toBeDefined()
  expect(await pane.find({ text: 'resets at 18:00 · in 3 h 28 min' })).toBeDefined()
  expect(await pane.find({ text: 'resets Sat 13:00 · in 2 d 22 h 28 min' })).toBeDefined()
  expect(await pane.find({ text: '169k of 1M' })).toBeDefined()
  await pane.press({ key: 'sources' })
  expect(await pane.find({ text: 'main conversation' })).toBeDefined()
})
