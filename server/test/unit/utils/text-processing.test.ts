import { describe, it, expect } from 'vitest';
import {
  expandTypeAbbreviations,
  cleanTypeNames,
  cleanSignature,
  cleanDocumentationText,
  parseCodeWithStringsAndComments,
  countBracesIgnoringStringsAndComments,
  countParenthesesIgnoringStringsAndComments,
  removeStringsFromLine,
} from '../../../src/utils/text-processing';

describe('type cleaning helpers', () => {
  it('expands type abbreviations', () => {
    expect(expandTypeAbbreviations('Ni Nl Ns Nf Nif Nis is')).toBe(
      'integer logical string float integer or float integer or string integer or string',
    );
  });

  it('removes singleton $ suffix and expands types', () => {
    expect(cleanTypeNames('integer$ object<DataFrame>$ Ni')).toBe('integer object<DataFrame> integer');
  });

  it('cleans signatures and collapses object<Clazz>', () => {
    expect(cleanSignature('object<DataFrame>$ -> Ni')).toBe('<DataFrame> -> integer');
  });
});

describe('cleanDocumentationText', () => {
  it('decodes HTML entities and cleans types', () => {
    const input = 'E.g. &lt;tag&gt; &amp; integer$ Ni';
    const output = cleanDocumentationText(input);
    expect(output).toContain('<tag> & integer integer');
  });

  it('strips span and formats basic tags', () => {
    const input = '<span><b>bold</b> <i>italics</i></span>';
    const output = cleanDocumentationText(input);
    expect(output).toBe('**bold** *italics*');
  });
});

describe('StringCommentStateMachine and helpers', () => {
  it('tracks string state correctly', () => {
    const code = '"a\\"b" // comment';
    let lastStateInString = false;

    parseCodeWithStringsAndComments(code, {}, (_char, state) => {
      lastStateInString = state.inString;
    });

    expect(lastStateInString).toBe(false);
  });

  it('detects escaped quotes', () => {
    const text = '\\""';
    // position 1 is the quote after a backslash => escaped
    // position 2 is an unescaped quote
    expect(removeStringsFromLine(text)).toMatch(/__STR0__/);
  });
});

describe('brace and parenthesis counting', () => {
  it('ignores braces inside strings and comments', () => {
    const line = '"{" // }';
    const counts = countBracesIgnoringStringsAndComments(line);
    expect(counts.openCount).toBe(0);
    expect(counts.closeCount).toBe(0);
  });

  it('counts parentheses outside of strings/comments', () => {
    const code = '("(") // )';
    const counts = countParenthesesIgnoringStringsAndComments(code);
    expect(counts.openCount).toBe(1);
    expect(counts.closeCount).toBe(1);
  });
});

describe('removeStringsFromLine', () => {
  it('replaces strings with stable placeholders', () => {
    const line = 'x = "a" + "b"';
    const result = removeStringsFromLine(line);
    expect(result).toBe('x = __STR0__ + __STR1__');
  });
});

