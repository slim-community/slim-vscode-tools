import { describe, it, expect } from 'vitest';
import type { Hover } from 'vscode-languageserver';
import { registerHoverProvider } from '../../src/providers/hover';
import type { LanguageServerContext } from '../../src/config/types';
import type { DocumentationService } from '../../src/services/documentation-service';

class MockDocumentationService implements Partial<DocumentationService> {
  getFunctions() { return {}; }
  getClasses() { return {} as any; }
  getCallbacks() { return {} as any; }
  getTypes() { return {} as any; }
  getOperators() {
    return {
      '+': {
        signature: '+',
        description: 'addition',
        symbol: '+',
      },
    } as any;
  }
}

function createHoverTestContext(source: string): { getHover: () => (params: any) => Hover | null | Promise<Hover | null> } {
  const document = {
    getText: () => source,
  } as any;

  let hoverHandler: any;
  const connection = {
    onHover: (handler: any) => {
      hoverHandler = handler;
    },
  } as any;

  const documents = {
    get: () => document,
  } as any;

  const documentationService = new MockDocumentationService() as DocumentationService;

  const ctx: LanguageServerContext = {
    connection,
    documents,
    documentationService,
  };

  registerHoverProvider(ctx);

  return {
    getHover: () => hoverHandler,
  };
}

describe('hover provider integration', () => {
  it('returns operator hover for +', async () => {
    const { getHover } = createHoverTestContext('1 + 2');
    const hover = await getHover()({
      textDocument: { uri: 'file:///test.slim' },
      position: { line: 0, character: 2 },
    });

    expect(hover).not.toBeNull();
    const value = (hover as Hover).contents as any;
    expect(typeof value.value).toBe('string');
    expect(value.value).toContain('+');
  });
});

