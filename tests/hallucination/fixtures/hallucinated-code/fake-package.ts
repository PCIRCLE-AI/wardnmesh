/**
 * Example of hallucinated code: importing from non-existent package
 */

// This package doesn't exist on npm
import { magicFunction } from 'super-awesome-nonexistent-lib';
import { anotherHelper } from 'fake-utils-2024';

export function processData(input: string): string {
  // Using functions from hallucinated packages
  const result = magicFunction(input);
  return anotherHelper(result);
}
