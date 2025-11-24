import { describe, it, expect } from 'vitest';
import { DocumentationService } from '../../../src/services/documentation-service';
import type { ClassInfo } from '../../../src/config/types';

describe('DocumentationService transformations', () => {
  it('transformFunctionData extracts return type and cleans signature', () => {
    const svc = new DocumentationService();
    const fn = (svc as any).transformFunctionData(
      's_func',
      { signatures: ['(i)$s_func(i x, f y)'], description: 'desc' },
      'category',
      'SLiM',
    );
    expect(fn.source).toBe('SLiM');
    expect(fn.returnType).toBeDefined();
    expect(typeof fn.signature).toBe('string');
  });

  it('transformCallbackData strips trailing callback suffixes', () => {
    const svc = new DocumentationService();
    const cb = (svc as any).transformCallbackData('initialize', {
      signature: 'initialize() callbacks',
      description: 'd',
    });

    expect(cb.signature).toBe('initialize()');
  });

  it('transformOperatorData sets symbol field', () => {
    const svc = new DocumentationService();
    const op = (svc as any).transformOperatorData(
      '+',
      { signature: '+', description: 'plus' },
      '+',
    );
    expect(op.symbol).toBe('+');
  });

  it('extractClassConstructors derives constructor info from class data', () => {
    const svc = new DocumentationService();
    const classes: Record<string, ClassInfo> = {
      Foo: {
        constructor: { signature: 'Foo(i x)', description: 'c' },
        methods: {},
        properties: {},
      },
      Bar: {
        constructor: { signature: 'None', description: 'none' },
        methods: {},
        properties: {},
      },
    };

    const ctors = (svc as any).extractClassConstructors(classes);
    expect(ctors.Foo.signature).toContain('Foo');
    expect(ctors.Bar.signature).toBe('None');
  });
});

