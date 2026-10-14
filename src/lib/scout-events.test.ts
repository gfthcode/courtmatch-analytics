import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumePendingScoutOpen, openScoutAgent, SCOUT_AGENT_OPEN_EVENT } from './scout-events';

afterEach(() => { consumePendingScoutOpen(); vi.unstubAllGlobals(); });

describe('Agent open request delivery', () => {
  it('remembers a click before the data-gated assistant is mounted', () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent });
    openScoutAgent('news');
    expect(dispatchEvent.mock.calls[0][0].type).toBe(SCOUT_AGENT_OPEN_EVENT);
    expect(consumePendingScoutOpen()).toEqual({ mode: 'news' });
    expect(consumePendingScoutOpen()).toBeUndefined();
  });
  it('keeps only the latest pending request including the automatic mode', () => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    openScoutAgent('lineup'); openScoutAgent();
    expect(consumePendingScoutOpen()).toEqual({ mode: undefined });
  });
});
