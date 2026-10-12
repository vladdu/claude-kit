export type ModelTier = 'haiku' | 'sonnet' | 'opus'

declare module 'claude-code' {
  interface PluginState {
    'model-router': {
      // The tier picked for this conversation, or 'default' for the session's own model.
      tier: ModelTier | 'default'
    }
  }
}
