import { ProviderKind, ProviderState } from './data-access/ai.models';

/** The kinds in the order of the dialog's grid (sketch AiProviderDialog). */
export const PROVIDER_KINDS: readonly ProviderKind[] = [
  'anthropic',
  'gemini',
  'openrouter',
  'deepseek',
  'openai-compatible',
];

/** The icon of a kind: on its card in the dialog and at the start of its row. */
export const KIND_ICONS: Record<ProviderKind, string> = {
  anthropic: 'tb-i-auto_awesome',
  gemini: 'tb-i-diamond',
  openrouter: 'tb-i-hub',
  deepseek: 'tb-i-water',
  'openai-compatible': 'tb-i-dns',
};

/** The address a kind uses when none is given (`ProviderKind.defaultBaseUrl`): the field's placeholder. */
export const KIND_ADDRESSES: Record<ProviderKind, string> = {
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com',
  'openai-compatible': 'http://host.docker.internal:11434/v1',
};

/** The tag of a connection's check (design-system §2: success, error, neutral). */
export const STATE_SEVERITY: Record<ProviderState, 'success' | 'danger' | 'secondary'> = {
  OK: 'success',
  FAILED: 'danger',
  UNCHECKED: 'secondary',
};
