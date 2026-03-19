/**
 * Input Validation Utilities
 *
 * Provides comprehensive input validation for all modules.
 * Ensures robust error handling and prevents invalid operations.
 */

/**
 * Package name validation regex (npm package name rules)
 *
 * Valid formats:
 * - Regular: 'package-name', 'package_name'
 * - Scoped: '@scope/package-name'
 *
 * Rules:
 * - Package name must be lowercase
 * - Can contain hyphens, underscores, dots
 * - Scoped packages start with @scope/
 * - No spaces, uppercase, or special chars except - _ . @/
 */
export const PACKAGE_NAME_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Validate that a value is a non-empty string
 *
 * @param value - Value to validate
 * @param paramName - Parameter name for error message
 * @throws TypeError if value is null, undefined, not a string, or empty
 */
export function validateNonEmptyString(value: unknown, paramName: string): asserts value is string {
  if (value === null) {
    throw new TypeError(`${paramName} cannot be null`);
  }

  if (value === undefined) {
    throw new TypeError(`${paramName} cannot be undefined`);
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${paramName} must be a string, got ${typeof value}`);
  }

  if (value.trim().length === 0) {
    throw new TypeError(`${paramName} cannot be empty`);
  }
}

/**
 * Validate package name format
 *
 * @param packageName - Package name to validate
 * @param paramName - Parameter name for error message
 * @throws TypeError if package name is invalid
 */
export function validatePackageName(packageName: unknown, paramName: string = 'packageName'): asserts packageName is string {
  validateNonEmptyString(packageName, paramName);

  if (!PACKAGE_NAME_REGEX.test(packageName)) {
    throw new TypeError(
      `${paramName} has invalid format: "${packageName}". ` +
      `Must be a valid npm package name (e.g., "package-name" or "@scope/package-name")`
    );
  }
}

/**
 * Validate that a value is a valid object (not null, not array)
 *
 * @param value - Value to validate
 * @param paramName - Parameter name for error message
 * @throws TypeError if value is null, undefined, or not an object
 */
export function validateObject(value: unknown, paramName: string): asserts value is Record<string, unknown> {
  if (value === null) {
    throw new TypeError(`${paramName} cannot be null`);
  }

  if (value === undefined) {
    throw new TypeError(`${paramName} cannot be undefined`);
  }

  if (typeof value !== 'object') {
    throw new TypeError(`${paramName} must be an object, got ${typeof value}`);
  }

  if (Array.isArray(value)) {
    throw new TypeError(`${paramName} must be an object, not an array`);
  }
}

/**
 * Validate that an object has required fields
 *
 * @param obj - Object to validate
 * @param requiredFields - Array of required field names
 * @param paramName - Parameter name for error message
 * @throws TypeError if any required field is missing
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  requiredFields: string[],
  paramName: string
): void {
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new TypeError(`${paramName} is missing required field: ${field}`);
    }

    if (obj[field] === undefined) {
      throw new TypeError(`${paramName}.${field} cannot be undefined`);
    }
  }
}

/**
 * Validate that a number is valid (not NaN, not Infinity)
 *
 * @param value - Value to validate
 * @param paramName - Parameter name for error message
 * @param options - Validation options
 * @throws TypeError if value is invalid
 */
export function validateNumber(
  value: unknown,
  paramName: string,
  options: {
    allowNegative?: boolean;
    min?: number;
    max?: number;
  } = {}
): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${paramName} must be a number, got ${typeof value}`);
  }

  if (Number.isNaN(value)) {
    throw new TypeError(`${paramName} cannot be NaN`);
  }

  if (!Number.isFinite(value)) {
    throw new TypeError(`${paramName} cannot be Infinity`);
  }

  if (options.allowNegative === false && value < 0) {
    throw new TypeError(`${paramName} cannot be negative, got ${value}`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new TypeError(`${paramName} must be >= ${options.min}, got ${value}`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new TypeError(`${paramName} must be <= ${options.max}, got ${value}`);
  }
}

/**
 * Validate that a value is an array
 *
 * @param value - Value to validate
 * @param paramName - Parameter name for error message
 * @throws TypeError if value is not an array
 */
export function validateArray(value: unknown, paramName: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${paramName} must be an array, got ${typeof value}`);
  }
}

/**
 * Validate that all array elements pass a validation function
 *
 * @param array - Array to validate
 * @param elementValidator - Validation function for each element
 * @param paramName - Parameter name for error message
 */
export function validateArrayElements<T>(
  array: unknown[],
  elementValidator: (element: unknown, index: number) => asserts element is T,
  paramName: string
): asserts array is T[] {
  array.forEach((element, index) => {
    try {
      elementValidator(element, index);
    } catch (error) {
      throw new TypeError(
        `${paramName}[${index}] validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
