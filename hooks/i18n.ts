// Every text pulse shows, in four languages. `Strings` makes each language complete:
// a missing entry is a type error, so `claude plugin validate` and tsc catch it.

export type Lang = 'en' | 'es' | 'fr' | 'ru'
export const LANGS: readonly Lang[] = ['en', 'es', 'fr', 'ru']

export type Strings = {
  weekdays: readonly string[] // Sunday first, as Date.getUTCDay()
  months: readonly string[]
  day: (weekday: string, date: number, month: string) => string
  units: { s: string; min: string; h: string; d: string }
  windows: Record<string, string>
  paneTitle: string
  noData: string
  context: string
  notMeasured: string
  of: (used: string, window: string) => string
  breakdown: string
  estimateAt: (time: string) => string
  limits: string
  noLimits: string
  sources: string
  sourcesNote: string
  main: string
  subagent: string
  session: string
  since: (time: string) => string
  atApiPrices: (usd: string) => string
  tokens: string
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
  tokensNote: string
  answered: (duration: string) => string
  contextShort: (percent: number) => string
  resetAt: (time: string) => string
  resetOn: (weekday: string, time: string) => string
  inTime: (left: string) => string
}

const en: Strings = {
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  day: (w, d, m) => `${w}, ${m} ${d}`,
  units: { s: 's', min: 'min', h: 'h', d: 'd' },
  windows: { five_hour: '5 hours', seven_day: 'Week', spend_limit: 'Spend' },
  paneTitle: 'Usage',
  noData: "Numbers appear after the model's first reply.",
  context: 'Context',
  notMeasured: 'not measured yet',
  of: (a, b) => `${a} of ${b}`,
  breakdown: 'breakdown',
  estimateAt: t => `estimate at ${t}, no API requests`,
  limits: 'Subscription limits',
  noLimits: 'no data: not a subscription, or no reply yet',
  sources: 'what uses the limits',
  sourcesNote: 'this session; shares are an estimate at API prices',
  main: 'main conversation',
  subagent: 'subagent',
  session: 'Session',
  since: t => `since ${t}`,
  atApiPrices: usd => `$${usd} at API prices`,
  tokens: 'tokens',
  input: 'Input',
  output: 'Output',
  cacheRead: 'Cache read',
  cacheWrite: 'Cache write',
  tokensNote: 'whole session from the transcript, with subagents',
  answered: d => `answered in ${d}`,
  contextShort: p => `context ${p}%`,
  resetAt: t => `resets at ${t}`,
  resetOn: (w, t) => `resets ${w} ${t}`,
  inTime: left => `in ${left}`,
}

const es: Strings = {
  weekdays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  day: (w, d, m) => `${w}, ${d} ${m}`,
  units: { s: 's', min: 'min', h: 'h', d: 'd' },
  windows: { five_hour: '5 horas', seven_day: 'Semana', spend_limit: 'Gasto' },
  paneTitle: 'Uso',
  noData: 'Las cifras aparecerán tras la primera respuesta del modelo.',
  context: 'Contexto',
  notMeasured: 'aún sin medir',
  of: (a, b) => `${a} de ${b}`,
  breakdown: 'desglose',
  estimateAt: t => `estimación a las ${t}, sin peticiones a la API`,
  limits: 'Límites de la suscripción',
  noLimits: 'sin datos: no es una suscripción o aún no hay respuesta',
  sources: 'qué consume los límites',
  sourcesNote: 'esta sesión; las proporciones son una estimación a precios de la API',
  main: 'conversación principal',
  subagent: 'subagente',
  session: 'Sesión',
  since: t => `desde las ${t}`,
  atApiPrices: usd => `$${usd} a precios de la API`,
  tokens: 'tokens',
  input: 'Entrada',
  output: 'Salida',
  cacheRead: 'Caché, lectura',
  cacheWrite: 'Caché, escritura',
  tokensNote: 'toda la sesión según la transcripción, con subagentes',
  answered: d => `respondió en ${d}`,
  contextShort: p => `contexto ${p}%`,
  resetAt: t => `se reinicia a las ${t}`,
  resetOn: (w, t) => `se reinicia el ${w} a las ${t}`,
  inTime: left => `en ${left}`,
}

const fr: Strings = {
  weekdays: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  day: (w, d, m) => `${w} ${d} ${m}`,
  units: { s: 's', min: 'min', h: 'h', d: 'j' },
  windows: { five_hour: '5 heures', seven_day: 'Semaine', spend_limit: 'Dépenses' },
  paneTitle: 'Consommation',
  noData: 'Les chiffres apparaîtront après la première réponse du modèle.',
  context: 'Contexte',
  notMeasured: 'pas encore mesuré',
  of: (a, b) => `${a} sur ${b}`,
  breakdown: 'détail',
  estimateAt: t => `estimation à ${t}, sans requête à l’API`,
  limits: 'Limites de l’abonnement',
  noLimits: 'pas de données : pas d’abonnement ou pas encore de réponse',
  sources: 'ce qui consomme les limites',
  sourcesNote: 'cette session ; parts estimées aux prix de l’API',
  main: 'conversation principale',
  subagent: 'sous-agent',
  session: 'Session',
  since: t => `depuis ${t}`,
  atApiPrices: usd => `${usd} $ aux prix de l’API`,
  tokens: 'jetons',
  input: 'Entrée',
  output: 'Sortie',
  cacheRead: 'Cache, lecture',
  cacheWrite: 'Cache, écriture',
  tokensNote: 'toute la session d’après la transcription, sous-agents compris',
  answered: d => `réponse en ${d}`,
  contextShort: p => `contexte ${p} %`,
  resetAt: t => `réinitialisation à ${t}`,
  resetOn: (w, t) => `réinitialisation ${w} à ${t}`,
  inTime: left => `dans ${left}`,
}

const ru: Strings = {
  weekdays: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  day: (w, d, m) => `${w}, ${d} ${m}`,
  units: { s: 'с', min: 'мин', h: 'ч', d: 'д' },
  windows: { five_hour: '5 часов', seven_day: 'Неделя', spend_limit: 'Расход' },
  paneTitle: 'Расход',
  noData: 'Цифры появятся после первого ответа модели.',
  context: 'Контекст',
  notMeasured: 'ещё не измерен',
  of: (a, b) => `${a} из ${b}`,
  breakdown: 'разбивка',
  estimateAt: t => `оценка на ${t}, без запросов к API`,
  limits: 'Лимиты подписки',
  noLimits: 'нет данных: не подписка или ещё не было ответа',
  sources: 'что расходует лимиты',
  sourcesNote: 'эта сессия; доли — оценка по ценам API',
  main: 'основной диалог',
  subagent: 'субагент',
  session: 'Сессия',
  since: t => `с ${t}`,
  atApiPrices: usd => `$${usd} по ценам API`,
  tokens: 'токены',
  input: 'Ввод',
  output: 'Вывод',
  cacheRead: 'Кэш, чтение',
  cacheWrite: 'Кэш, запись',
  tokensNote: 'вся сессия по транскрипту, с субагентами',
  answered: d => `отвечал ${d}`,
  contextShort: p => `контекст ${p}%`,
  resetAt: t => `сброс в ${t}`,
  resetOn: (w, t) => `сброс ${w} ${t}`,
  inTime: left => `через ${left}`,
}

export const STRINGS: Record<Lang, Strings> = { en, es, fr, ru }

// A language from Claude Code's `language` setting ("russian", "Español") or a locale
// ("ru_RU.UTF-8", "fr_CA"); undefined when it names none of the four.
export function langOf(text: unknown): Lang | undefined {
  if (typeof text !== 'string') return undefined
  const s = text.trim().toLowerCase()
  if (s === '' || s === 'c' || s.startsWith('c.') || s === 'posix') return undefined
  if (/^(ru|рус|russ)/.test(s)) return 'ru'
  if (/^(es|spa|espa)/.test(s)) return 'es'
  if (/^(fr|fra|fre)/.test(s)) return 'fr'
  if (/^(en|eng|анг)/.test(s)) return 'en'

  return undefined
}
