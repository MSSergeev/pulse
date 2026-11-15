import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Answer, Breakdown } from '../types'
import { LANGS, STRINGS, langOf } from './i18n'
import type { Lang, Strings } from './i18n'

const answers = atom({ plugin: 'pulse', key: 'answers' } as const, {})
const isOpen = atom({ plugin: 'pulse', key: 'isOpen' } as const, false)
const offsetMin = atom({ plugin: 'pulse', key: 'offsetMin' } as const, 0)
const usage = atom({ plugin: 'pulse', key: 'usage' } as const, null)
// Метка формата: значение прежнего вида (без `by`) после перезагрузки мода отбрасывается.
const tokens = atom({ plugin: 'pulse', key: 'tokens' } as const, null, { shape: 'by-source' })
const breakdown = atom({ plugin: 'pulse', key: 'breakdown' } as const, null)
const isTokensShown = atom({ plugin: 'pulse', key: 'isTokensShown' } as const, false)
const isContextShown = atom({ plugin: 'pulse', key: 'isContextShown' } as const, false)
// Последний текстовый блок главного цикла за ход — это и есть ответ. В состоянии, а не в
// переменной модуля: мод может перезагрузиться посреди хода.
const lastText = atom({ plugin: 'pulse', key: 'lastText' } as const, null)
const isSourcesShown = atom({ plugin: 'pulse', key: 'isSourcesShown' } as const, false)
// Язык интерфейса: выбор из настроек мода или, при `auto`, определённый в session.start.
const lang = atom({ plugin: 'pulse', key: 'lang' } as const, 'en')
// Минутный тик: панель перерисовывается, и «осталось до сброса» не устаревает между ответами.
const tick = atom({ plugin: 'pulse', key: 'tick' } as const, 0)

const PANE = 'usage'
const KEEP = 2000
const RING = ['○', '◔', '◑', '◕', '●']

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const chosen = await pickLang($, options.language)
    await update($, lang, () => chosen)

    const date = await $.process.run(['date', '+%z']).catch(() => undefined)
    const offset = parseOffset(date?.stdout ?? '') ?? -new Date().getTimezoneOffset()
    await update($, offsetMin, () => offset)

    const stored = (await $.store.get('answers')) as Record<string, Answer> | undefined
    if (stored !== undefined) {
      const byRow = Object.fromEntries(Object.entries(stored).map(([id, answer]) => [rowKey(id), answer]))
      await update($, answers, live => ({ ...byRow, ...live }))
    }

    const fresh = await $.session.usage()
    await update($, usage, () => fresh)
    $.ui.status(undefined)

    const at = await $.clock.now()
    await update($, tick, () => at)
    $.clock.every(60_000, async () => {
      const at = await $.clock.now()
      await update($, tick, () => at)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const fresh = await $.session.usage()
    await update($, usage, () => fresh)
    if (await read($, isContextShown)) await refreshBreakdown($)
    if ((await read($, isTokensShown)) || (await read($, isSourcesShown))) await refreshTokens($)

    return next(e)
  })

  on('session.append', { door: 'response' }, async ($, e, next) => {
    const stored = await next(e)
    const hasText = e.message.content.some(b => b.type === 'text' && String(b.text).trim() !== '')
    if (e.agentId === undefined && hasText && stored.deny === undefined) {
      await update($, lastText, () => stored.uuid)
    }

    return stored
  })

  on('turn.complete', async ($, e, next) => {
    const id = await read($, lastText)
    if (e.agentId === undefined && id !== null) {
      await update($, lastText, () => null)
      const { context } = await $.session.usage()
      const answer: Answer = {
        at: await $.clock.now(),
        durationMs: e.durationMs,
        contextPercent: context.percent,
      }
      const all = await update($, answers, list => newest({ ...list, [rowKey(id)]: answer }))
      await $.store.set('answers', all)
    }

    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const answer = (await read($, answers))[rowKey(e.requestId)]
    if (answer === undefined) return next(e)

    const open = memberOf(isOpen, e)
    const offset = await read($, offsetMin)
    const t = STRINGS[await read($, lang)]
    const label = (await read($, open)) ? fullTime(t, answer, offset) : hhmm(local(answer.at, offset))
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Box key="chip" paddingLeft={2}>
          <Button
            key="time"
            plain
            dimColor
            hover={{ underline: true }}
            onPress={() => update($, open, isShown => !isShown)}
          >
            ◷ {label}
          </Button>
        </Box>
      </Box>
    )
  })

  // Колечко справа в нижней строке; в приложении для компьютера есть своё.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const percent = (await read($, usage))?.context.percent
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box key="ring" flexDirection="row" gap={1}>
        {await next(e)}
        <Button key="usage" plain hover={{ underline: true }} onPress={() => togglePane($)}>
          <Text color={tone(percent ?? 0)}>{ring(percent ?? 0)}</Text>
          <Text dimColor> {percent === undefined ? '—' : `${percent}%`}</Text>
        </Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = STRINGS[await read($, lang)]
    const now = await read($, usage)
    const offset = await read($, offsetMin)
    const sum = await read($, tokens)
    const parts = await read($, breakdown)
    const isContext = await read($, isContextShown)
    const isTokens = await read($, isTokensShown)
    const nowMs = (await read($, tick)) || (await $.clock.now())
    const width = Math.max(10, e.props.bodyColumns - 1)

    const bar = (segments: { share: number; color: string }[]) => {
      let used = 0
      const drawn = segments.map(({ share, color }) => {
        const line = segments.length === 1 ? fill(share, width) : '━'.repeat(Math.round(share * width))
        const cut = line.slice(0, width - used)
        used += cut.length
        return <Text color={color}>{cut}</Text>
      })
      return (
        <Text>
          {drawn}
          <Text dimColor>{'─'.repeat(width - used)}</Text>
        </Text>
      )
    }
    const row = (title: string, value: string, color?: string) => (
      <Box justifyContent="space-between">
        <Text>{title}</Text>
        <Text color={color} weight="semibold">
          {value}
        </Text>
      </Box>
    )
    const heading = (title: string) => (
      <Box marginTop={1}>
        <Text weight="bold">{title}</Text>
      </Box>
    )
    const toggle = (key: string, isShown: boolean, title: string, flip: () => unknown) => (
      <Box key={`${key}-box`}>
        <Button key={key} plain dimColor hover={{ underline: true }} onPress={flip}>
          {isShown ? '▾' : '▸'} {title}
        </Button>
      </Box>
    )

    if (now === null) return <Text dimColor>{t.noData}</Text>

    const context = now.context
    const percent = context.percent ?? 0
    const label = context.percent === undefined ? '—' : `${percent}%`
    const isSources = await read($, isSourcesShown)
    const weight = sum?.by.reduce((all, one) => all + one.weight, 0) ?? 0

    return (
      <Box flexDirection="column">
        <Text weight="bold">{t.context}</Text>
        {row(
          context.tokens === undefined ? t.notMeasured : t.of(fmt(context.tokens), fmt(context.window)),
          label,
          tone(percent),
        )}
        {bar(
          isContext && parts !== null
            ? parts.categories
                .filter(c => c.kind === 'used')
                .map(c => ({ share: c.tokens / parts.max, color: c.color }))
            : [{ share: percent / 100, color: tone(percent) }],
        )}
        {toggle('context', isContext, t.breakdown, async () => {
          const isShown = await update($, isContextShown, shown => !shown)
          if (isShown) await refreshBreakdown($)
        })}
        {isContext && parts !== null && (
          <Box flexDirection="column">
            {parts.categories.map(c => (
              <Box justifyContent="space-between">
                <Text>
                  <Text color={c.color}>●</Text> {c.name}
                </Text>
                <Text dimColor>
                  {fmt(c.tokens).padStart(6)}
                  {c.kind === 'deferred' ? '      —' : `${((c.tokens / parts.max) * 100).toFixed(1)}%`.padStart(7)}
                </Text>
              </Box>
            ))}
            <Text dimColor>{t.estimateAt(hhmm(local(parts.at, offset)))}</Text>
          </Box>
        )}

        {heading(t.limits)}
        {now.rateLimits.length === 0 && <Text dimColor>{t.noLimits}</Text>}
        {now.rateLimits.map(limit => (
          <Box flexDirection="column" marginTop={1}>
            {row(t.windows[limit.kind] ?? limit.kind, `${limit.percentUsed}%`, tone(limit.percentUsed))}
            {bar([{ share: limit.percentUsed / 100, color: tone(limit.percentUsed) }])}
            <Text dimColor>{resetLabel(t, limit, offset, nowMs)}</Text>
          </Box>
        ))}
        {toggle('sources', isSources, t.sources, async () => {
          const isShown = await update($, isSourcesShown, shown => !shown)
          if (isShown) await refreshTokens($)
        })}
        {isSources && sum !== null && weight > 0 && (
          <Box flexDirection="column">
            {sum.by.map(one => (
              <Box flexDirection="column">
                {row(sourceName(t, one.name), `${Math.round((one.weight / weight) * 100)}%`)}
                {bar([{ share: one.weight / weight, color: 'suggestion' }])}
              </Box>
            ))}
            <Text dimColor>{t.sourcesNote}</Text>
          </Box>
        )}

        {heading(t.session)}
        <Text dimColor>
          {t.since(hhmm(local(now.startedAt, offset)))}
          {now.cost === undefined ? '' : ` · ${t.atApiPrices(now.cost.usd.toFixed(2))}`}
        </Text>
        {toggle('tokens', isTokens, t.tokens, async () => {
          const isShown = await update($, isTokensShown, shown => !shown)
          if (isShown) await refreshTokens($)
        })}
        {isTokens && sum !== null && (
          <Box flexDirection="column">
            {row(t.input, fmt(sum.input))}
            {row(t.output, fmt(sum.output))}
            {row(t.cacheRead, fmt(sum.cacheRead))}
            {row(t.cacheWrite, fmt(sum.cacheWrite))}
            <Text dimColor>{t.tokensNote}</Text>
          </Box>
        )}
      </Box>
    )
  })
}

// Выбор в настройках мода; при `auto` — язык ответов Claude Code (настройка `language`),
// затем язык системы (LC_ALL, LC_MESSAGES, LANG), затем английский.
async function pickLang($: EngineInterface, chosen: unknown): Promise<Lang> {
  if (typeof chosen === 'string' && (LANGS as readonly string[]).includes(chosen)) return chosen as Lang
  const setting = await $.settings.read({ key: 'language' }).catch(() => undefined)
  const found =
    langOf(setting) ??
    langOf(await $.env.get('LC_ALL').catch(() => undefined)) ??
    langOf(await $.env.get('LC_MESSAGES').catch(() => undefined)) ??
    langOf(await $.env.get('LANG').catch(() => undefined))

  return found ?? 'en'
}

// Скрипт называет основной диалог и субагент без типа служебными именами.
const sourceName = (t: Strings, name: string) => (name === '@main' ? t.main : name === '@subagent' ? t.subagent : name)

async function togglePane($: EngineInterface) {
  const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (isUp) await $.ui.close({ id: PANE })
  else await $.ui.open({ id: PANE, title: STRINGS[await read($, lang)].paneTitle, closeOnEscape: true })
}

// `summary` считает локально и не шлёт запросов; `full` шлёт запросы подсчёта токенов, как /context.
async function refreshBreakdown($: EngineInterface) {
  const found = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  if (found === undefined) return

  const at = await $.clock.now()
  const parts: Breakdown = {
    at,
    total: found.totalTokens,
    max: found.rawMaxTokens,
    categories: found.categories.map(({ name, tokens, color, kind }) => ({ name, tokens, color, kind })),
  }
  await update($, breakdown, () => parts)
}

// Транскрипт бывает больше 4 МБ — предела $.fs.read, поэтому считает скрипт.
async function refreshTokens($: EngineInterface) {
  const script = `${$.plugin.root}/scripts/session_tokens.py`
  const ran = await $.process.run(['python3', '-I', script, await $.session.id()])
  if (ran.exitCode !== 0) throw new Error(`session_tokens.py: ${ran.stderr.trim()}`)

  const found = JSON.parse(ran.stdout) as { total: number[]; by: [string, number][] }
  const [input = 0, output = 0, cacheRead = 0, cacheWrite = 0] = found.total
  const by = found.by.map(([name, weight]) => ({ name, weight }))
  await update($, tokens, () => ({ input, output, cacheRead, cacheWrite, by }))
}

// Ответ рисуется то под uuid строки транскрипта, то под производным id: первые четыре
// группы те же, последняя — номер блока (`…-000000000000`). Поэтому ключ — первые
// четыре группы (замечено 2026-10-15, Claude Code 2.1.299).
const rowKey = (id: string) => id.slice(0, 23)

function newest(all: Record<string, Answer>): Record<string, Answer> {
  return Object.fromEntries(
    Object.entries(all)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, KEEP),
  )
}

// Среда модов может не знать часового пояса машины: смещение берём у `date +%z`
// и местное время читаем из UTC-полей сдвинутой даты.
function parseOffset(z: string): number | undefined {
  const m = /^([+-])(\d\d)(\d\d)$/.exec(z.trim())
  if (m === null) return undefined

  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}

const local = (ms: number, offset: number) => new Date(ms + offset * 60_000)
const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`

function fullTime(t: Strings, answer: Answer, offset: number): string {
  const d = local(answer.at, offset)
  const day = t.day(t.weekdays[d.getUTCDay()] ?? '', d.getUTCDate(), t.months[d.getUTCMonth()] ?? '')
  const context = answer.contextPercent === undefined ? '' : ` · ${t.contextShort(answer.contextPercent)}`

  return `${hhmm(d)}:${pad(d.getUTCSeconds())} · ${day} · ${t.answered(duration(t, answer.durationMs))}${context}`
}

function duration(t: Strings, ms: number): string {
  const { s: S, min: M, h: H } = t.units
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} ${S}`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} ${M} ${s % 60} ${S}`

  return `${Math.floor(m / 60)} ${H} ${m % 60} ${M}`
}

function resetLabel(t: Strings, limit: SessionRateLimit, offset: number, nowMs: number): string {
  if (limit.resetsAt === undefined) return ''
  const at = Date.parse(limit.resetsAt)
  const d = local(at, offset)
  const when = limit.kind === 'five_hour' ? t.resetAt(hhmm(d)) : t.resetOn(t.weekdays[d.getUTCDay()] ?? '', hhmm(d))

  return at > nowMs ? `${when} · ${t.inTime(remaining(t, at - nowMs))}` : when
}

// До сброса: «2 ч 15 мин», «3 д 5 ч 12 мин», «42 мин»; минуты округляются вверх,
// чтобы не показать «0 мин», пока сброс ещё не наступил.
function remaining(t: Strings, ms: number): string {
  const { d: D, h: H, min: M } = t.units
  const total = Math.max(1, Math.ceil(ms / 60_000))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const minutes = total % 60
  const parts = [days > 0 ? `${days} ${D}` : '', days > 0 || hours > 0 ? `${hours} ${H}` : '', `${minutes} ${M}`]

  return parts.filter(p => p !== '').join(' ')
}

// Тонкая полоска с шагом в полклетки: ╸ — левая половина жирной линии.
function fill(share: number, width: number): string {
  const halves = Math.round(Math.max(0, Math.min(1, share)) * width * 2)

  return '━'.repeat(Math.floor(halves / 2)) + (halves % 2 === 1 ? '╸' : '')
}


const ring = (percent: number) => RING[Math.max(0, Math.min(4, Math.round(percent / 25)))] ?? '○'
const tone = (percent: number) =>
  percent >= 90 ? ('error' as const) : percent >= 70 ? ('warning' as const) : ('suggestion' as const)
const fmt = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n)
