import { describe, it, expect } from 'vitest';
import { getOperatorAtPosition, getWordAndContextAtPosition, getAutocompleteContextAtPosition } from '../../../src/utils/positions';
import type { Position } from 'vscode-languageserver';

function pos(line: number, character: number): Position {
  return { line, character } as Position;
}

describe('getOperatorAtPosition', () => {
  const code = '1 + 2\n3 <= 4\n5 && 6\n7 < 8';

  it('returns single-character operator at cursor', () => {
    expect(getOperatorAtPosition(code, pos(0, 2))).toBe('+');
  });

  it('returns multi-character operator when cursor is anywhere on it', () => {
    expect(getOperatorAtPosition(code, pos(1, 3))).toBe('<=');
    expect(getOperatorAtPosition(code, pos(2, 3))).toBe('&&');
  });

  it('returns null when no operator at position', () => {
    expect(getOperatorAtPosition(code, pos(0, 0))).toBeNull();
  });
});

describe('getWordAndContextAtPosition', () => {
  const text = 'sim.addSubpop(\"p1\", 100);\nobj.method();\nstandalone';

  it('returns method context when cursor is on method name', () => {
    const info = getWordAndContextAtPosition(text, pos(0, 6), {
      instanceDefinitions: { sim: 'SLiMSim' },
      resolveClassName: (name) => (name === 'sim' ? 'SLiMSim' : null),
    });
    expect(info).not.toBeNull();
    expect(info!.word).toBe('addSubpop');
    expect(info!.context.isMethodOrProperty).toBe(true);
    expect(info!.context.className).toBe('SLiMSim');
    expect(info!.context.instanceName).toBe('sim');
  });

  it('returns instance context when cursor is on object name', () => {
    const info = getWordAndContextAtPosition(text, pos(1, 1), {
      instanceDefinitions: { obj: 'SomeClass' },
    });
    expect(info).not.toBeNull();
    expect(info!.word).toBe('obj');
    expect(info!.context.isMethodOrProperty).toBe(false);
    expect(info!.context.instanceClass).toBe('SomeClass');
  });

  it('returns plain word when not part of dot expression', () => {
    const info = getWordAndContextAtPosition(text, pos(2, 0), {});
    expect(info).toBeNull();
  });
});

describe('getAutocompleteContextAtPosition', () => {
  const text = 'obj.\nstandalone';

  it('detects method/property completion context after dot', () => {
    const info = getAutocompleteContextAtPosition(text, pos(0, 4), {
      instanceDefinitions: { obj: 'SomeClass' },
      resolveClassName: (name, defs) => defs[name] || null,
    });

    expect(info).not.toBeNull();
    expect(info!.context.isMethodOrProperty).toBe(true);
    expect(info!.context.className).toBe('SomeClass');
    expect(info!.context.instanceName).toBe('obj');
  });

  it('returns identifier context when not after dot', () => {
    const info = getAutocompleteContextAtPosition(text, pos(1, 2));
    expect(info).not.toBeNull();
    expect(info!.word).toBe('st');
    expect(info!.context.isMethodOrProperty).toBe(false);
  });
});

