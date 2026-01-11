import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeQuestionResp, checkForConfigFile, createConfigFile } from '../print_detect_index.js';


// ============================================
// Direct Testing for Pure Functions
// ============================================
// These functions have no side effects, so we can test them directly
// with mock data - no dependency injection needed!
// console.log
describe('normalizeQuestionResp', () => {
  it('should parse comma-separated file extensions without spaces', () => {
    // Arrange - Note: no spaces after commas, or validation will fail
    const input = '.ts,.js,.tsx';

    // Act
    const result = normalizeQuestionResp(input, 'y', 'console.log', 'n');

    // Assert
    assert.deepStrictEqual(result.fileExtensions, ['.ts', '.js', '.tsx']);
  });

  it('should convert "y" to true for warnOnly', () => {
    const result = normalizeQuestionResp('.ts', 'y', 'console.log', 'n');
    assert.strictEqual(result.warnOnly, true);
  });

  it('should convert "n" to false for warnOnly', () => {
    const result = normalizeQuestionResp('.ts', 'n', 'console.log', 'n');
    assert.strictEqual(result.warnOnly, false);
  });

  it('should parse multiple search terms', () => {
    const result = normalizeQuestionResp('.ts', 'y', 'console.log, debugger, alert', 'y');
    assert.deepStrictEqual(result.searchTerms, ['console.log', 'debugger', 'alert']);
  });

  it('should handle hasLineDetails flag', () => {
    const result1 = normalizeQuestionResp('.ts', 'y', 'console.log', 'y');
    assert.strictEqual(result1.hasLineDetails, true);

    const result2 = normalizeQuestionResp('.ts', 'y', 'console.log', 'n');
    assert.strictEqual(result2.hasLineDetails, false);
  });

  it('should trim outer whitespace from file extensions', () => {
    // Note: only fileExtensions string gets trimmed, not y/n values
    const result = normalizeQuestionResp(
      '  .ts,.js  ',  // Outer spaces will be trimmed
      'y',            // y/n values are not trimmed, must be exact
      'console.log,debugger',
      'n'
    );

    assert.deepStrictEqual(result.fileExtensions, ['.ts', '.js']);
    assert.deepStrictEqual(result.searchTerms, ['console.log', 'debugger']);
  });

  it('should handle single values without commas', () => {
    const result = normalizeQuestionResp('.ts', 'n', 'console.log', 'y');

    assert.deepStrictEqual(result.fileExtensions, ['.ts']);
    assert.deepStrictEqual(result.searchTerms, ['console.log']);
  });

  it('should create complete config object with all fields', () => {
    const result = normalizeQuestionResp('.tsx', 'y', 'console.warn', 'n');

    // Verify all required fields are present
    assert.ok(Array.isArray(result.fileExtensions));
    assert.strictEqual(typeof result.warnOnly, 'boolean');
    assert.ok(Array.isArray(result.searchTerms));
    assert.strictEqual(typeof result.hasLineDetails, 'boolean');
  });
});