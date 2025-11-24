import { describe, it, expect, vi } from 'vitest';
import { initializeLogger, log, logError, logErrorWithStack } from '../../../src/utils/logger';

function createMockConnection() {
  return {
    console: {
      log: vi.fn(),
      error: vi.fn(),
    },
  } as any;
}

describe('logger', () => {
  it('logs to console logger by default', () => {
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    log('info');
    logError('oops');

    expect(spyLog).toHaveBeenCalled();
    expect(spyErr).toHaveBeenCalled();

    spyLog.mockRestore();
    spyErr.mockRestore();
  });

  it('uses connection logger after initialization', () => {
    const conn = createMockConnection();
    initializeLogger(conn);

    log('hello');
    logError('bad');

    expect(conn.console.log).toHaveBeenCalledWith('hello');
    expect(conn.console.error).toHaveBeenCalledWith('bad');
  });

  it('logErrorWithStack logs message and stack', () => {
    const conn = createMockConnection();
    initializeLogger(conn);

    const error = new Error('boom');
    logErrorWithStack(error, 'context');

    const messages = (conn.console.error as any).mock.calls.map((c: any[]) => c[0]);
    expect(messages.some((m: string) => m.includes('context: boom'))).toBe(true);
  });
});