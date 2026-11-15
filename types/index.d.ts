export type Answer = { at: number; durationMs: number; contextPercent?: number }
export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  // A source's weight estimates its share of the limit spent (see scripts/session_tokens.py).
  by: { name: string; weight: number }[]
}
export type Category = { name: string; tokens: number; color: string; kind: string }
export type Breakdown = { at: number; total: number; max: number; categories: Category[] }

declare module 'claude-code' {
  interface PluginState {
    pulse: {
      answers: Record<string, Answer>
      isOpen: StateFamily<boolean>
      offsetMin: number
      usage: SessionUsage | null
      tokens: Shaped<Tokens | null>
      breakdown: Breakdown | null
      isTokensShown: boolean
      isContextShown: boolean
      isSourcesShown: boolean
      lastText: string | null
      tick: number
      lang: 'en' | 'es' | 'fr' | 'ru'
    }
  }
}
