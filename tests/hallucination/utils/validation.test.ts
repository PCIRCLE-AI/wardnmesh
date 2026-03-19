/**
 * Input Validation Tests
 *
 * Comprehensive tests for validation utilities
 */

import {
  validateNonEmptyString,
  validatePackageName,
  validateObject,
  validateRequiredFields,
  validateNumber,
  validateArray,
  validateArrayElements,
  PACKAGE_NAME_REGEX,
} from '../../../src/hallucination/utils/validation';

describe('Input Validation', () => {
  describe('validateNonEmptyString', () => {
    it('should accept valid non-empty strings', () => {
      expect(() => validateNonEmptyString('hello', 'test')).not.toThrow();
      expect(() => validateNonEmptyString('  spaces  ', 'test')).not.toThrow();
    });

    it('should reject null', () => {
      expect(() => validateNonEmptyString(null, 'test'))
        .toThrow(TypeError);
      expect(() => validateNonEmptyString(null, 'test'))
        .toThrow('test cannot be null');
    });

    it('should reject undefined', () => {
      expect(() => validateNonEmptyString(undefined, 'test'))
        .toThrow(TypeError);
      expect(() => validateNonEmptyString(undefined, 'test'))
        .toThrow('test cannot be undefined');
    });

    it('should reject non-string types', () => {
      expect(() => validateNonEmptyString(123, 'test'))
        .toThrow(TypeError);
      expect(() => validateNonEmptyString(123, 'test'))
        .toThrow('test must be a string, got number');
    });

    it('should reject empty strings', () => {
      expect(() => validateNonEmptyString('', 'test'))
        .toThrow(TypeError);
      expect(() => validateNonEmptyString('', 'test'))
        .toThrow('test cannot be empty');
    });

    it('should reject whitespace-only strings', () => {
      expect(() => validateNonEmptyString('   ', 'test'))
        .toThrow(TypeError);
      expect(() => validateNonEmptyString('   ', 'test'))
        .toThrow('test cannot be empty');
    });
  });

  describe('validatePackageName', () => {
    describe('valid package names', () => {
      const validNames = [
        'react',
        'vue',
        'my-package',
        'my_package',
        'my.package',
        '@types/node',
        '@scope/package-name',
        '@my-org/my-package',
      ];

      validNames.forEach(name => {
        it(`should accept valid package name: ${name}`, () => {
          expect(() => validatePackageName(name, 'test')).not.toThrow();
        });
      });
    });

    describe('invalid package names', () => {
      const invalidCases: Array<[unknown, string]> = [
        [null, 'null'],
        [undefined, 'undefined'],
        [123, 'number'],
        ['', 'empty string'],
        ['   ', 'whitespace'],
        ['MyPackage', 'uppercase'],
        ['my package', 'spaces'],
        ['my/package', 'slash without scope'],
        ['@/package', 'invalid scope'],
        ['@scope/', 'missing package name'],
        ['@scope', 'missing package name'],
        ['package!', 'special char'],
        ['package#name', 'special char'],
      ];

      invalidCases.forEach(([value, desc]) => {
        it(`should reject invalid package name: ${desc}`, () => {
          expect(() => validatePackageName(value, 'test'))
            .toThrow(TypeError);
        });
      });
    });

    it('should include package name in error message', () => {
      expect(() => validatePackageName('Invalid!', 'packageName'))
        .toThrow('packageName has invalid format: "Invalid!"');
    });
  });

  describe('PACKAGE_NAME_REGEX', () => {
    it('should match valid npm package names', () => {
      expect(PACKAGE_NAME_REGEX.test('react')).toBe(true);
      expect(PACKAGE_NAME_REGEX.test('@types/node')).toBe(true);
      expect(PACKAGE_NAME_REGEX.test('my-package')).toBe(true);
    });

    it('should not match invalid package names', () => {
      expect(PACKAGE_NAME_REGEX.test('My-Package')).toBe(false);
      expect(PACKAGE_NAME_REGEX.test('my package')).toBe(false);
      expect(PACKAGE_NAME_REGEX.test('package!')).toBe(false);
    });
  });

  describe('validateObject', () => {
    it('should accept valid objects', () => {
      expect(() => validateObject({}, 'test')).not.toThrow();
      expect(() => validateObject({ foo: 'bar' }, 'test')).not.toThrow();
    });

    it('should reject null', () => {
      expect(() => validateObject(null, 'test'))
        .toThrow(TypeError);
      expect(() => validateObject(null, 'test'))
        .toThrow('test cannot be null');
    });

    it('should reject undefined', () => {
      expect(() => validateObject(undefined, 'test'))
        .toThrow(TypeError);
      expect(() => validateObject(undefined, 'test'))
        .toThrow('test cannot be undefined');
    });

    it('should reject non-objects', () => {
      expect(() => validateObject('string', 'test'))
        .toThrow(TypeError);
      expect(() => validateObject('string', 'test'))
        .toThrow('test must be an object, got string');
    });

    it('should reject arrays', () => {
      expect(() => validateObject([], 'test'))
        .toThrow(TypeError);
      expect(() => validateObject([], 'test'))
        .toThrow('test must be an object, not an array');
    });
  });

  describe('validateRequiredFields', () => {
    it('should accept object with all required fields', () => {
      const obj = { name: 'test', age: 25 };
      expect(() => validateRequiredFields(obj, ['name', 'age'], 'test'))
        .not.toThrow();
    });

    it('should reject object missing required field', () => {
      const obj = { name: 'test' };
      expect(() => validateRequiredFields(obj, ['name', 'age'], 'test'))
        .toThrow(TypeError);
      expect(() => validateRequiredFields(obj, ['name', 'age'], 'test'))
        .toThrow('test is missing required field: age');
    });

    it('should reject object with undefined field', () => {
      const obj = { name: 'test', age: undefined };
      expect(() => validateRequiredFields(obj, ['name', 'age'], 'test'))
        .toThrow(TypeError);
      expect(() => validateRequiredFields(obj, ['name', 'age'], 'test'))
        .toThrow('test.age cannot be undefined');
    });

    it('should accept empty required fields array', () => {
      expect(() => validateRequiredFields({}, [], 'test'))
        .not.toThrow();
    });
  });

  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      expect(() => validateNumber(0, 'test')).not.toThrow();
      expect(() => validateNumber(42, 'test')).not.toThrow();
      expect(() => validateNumber(-10, 'test')).not.toThrow();
      expect(() => validateNumber(3.14, 'test')).not.toThrow();
    });

    it('should reject non-numbers', () => {
      expect(() => validateNumber('123', 'test'))
        .toThrow(TypeError);
      expect(() => validateNumber('123', 'test'))
        .toThrow('test must be a number, got string');
    });

    it('should reject NaN', () => {
      expect(() => validateNumber(NaN, 'test'))
        .toThrow(TypeError);
      expect(() => validateNumber(NaN, 'test'))
        .toThrow('test cannot be NaN');
    });

    it('should reject Infinity', () => {
      expect(() => validateNumber(Infinity, 'test'))
        .toThrow(TypeError);
      expect(() => validateNumber(Infinity, 'test'))
        .toThrow('test cannot be Infinity');

      expect(() => validateNumber(-Infinity, 'test'))
        .toThrow(TypeError);
    });

    it('should reject negative numbers when allowNegative is false', () => {
      expect(() => validateNumber(-5, 'test', { allowNegative: false }))
        .toThrow(TypeError);
      expect(() => validateNumber(-5, 'test', { allowNegative: false }))
        .toThrow('test cannot be negative, got -5');
    });

    it('should accept negative numbers when allowNegative is not specified', () => {
      expect(() => validateNumber(-5, 'test')).not.toThrow();
    });

    it('should enforce min constraint', () => {
      expect(() => validateNumber(5, 'test', { min: 10 }))
        .toThrow(TypeError);
      expect(() => validateNumber(5, 'test', { min: 10 }))
        .toThrow('test must be >= 10, got 5');

      expect(() => validateNumber(10, 'test', { min: 10 }))
        .not.toThrow();
    });

    it('should enforce max constraint', () => {
      expect(() => validateNumber(15, 'test', { max: 10 }))
        .toThrow(TypeError);
      expect(() => validateNumber(15, 'test', { max: 10 }))
        .toThrow('test must be <= 10, got 15');

      expect(() => validateNumber(10, 'test', { max: 10 }))
        .not.toThrow();
    });
  });

  describe('validateArray', () => {
    it('should accept arrays', () => {
      expect(() => validateArray([], 'test')).not.toThrow();
      expect(() => validateArray([1, 2, 3], 'test')).not.toThrow();
    });

    it('should reject non-arrays', () => {
      expect(() => validateArray({}, 'test'))
        .toThrow(TypeError);
      expect(() => validateArray({}, 'test'))
        .toThrow('test must be an array, got object');
    });
  });

  describe('validateArrayElements', () => {
    it('should validate all array elements', () => {
      const validator = (element: unknown): asserts element is number => {
        if (typeof element !== 'number') {
          throw new TypeError('must be a number');
        }
      };

      expect(() => validateArrayElements([1, 2, 3], validator, 'test'))
        .not.toThrow();
    });

    it('should report index of invalid element', () => {
      const validator = (element: unknown): asserts element is number => {
        if (typeof element !== 'number') {
          throw new TypeError('must be a number');
        }
      };

      expect(() => validateArrayElements([1, 'invalid', 3], validator, 'test'))
        .toThrow(TypeError);
      expect(() => validateArrayElements([1, 'invalid', 3], validator, 'test'))
        .toThrow('test[1] validation failed');
    });

    it('should include original error message', () => {
      const validator = (element: unknown): asserts element is number => {
        if (typeof element !== 'number') {
          throw new TypeError('must be a number');
        }
      };

      expect(() => validateArrayElements([1, 'invalid', 3], validator, 'test'))
        .toThrow('must be a number');
    });
  });
});
