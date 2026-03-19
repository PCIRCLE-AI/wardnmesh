/**
 * Integration tests for Detection Orchestrator
 *
 * Testing Strategy:
 * - Test parallel execution of multiple detection layers
 * - Test execution time (fast layers < 200ms)
 * - Test issue aggregation from multiple layers
 * - Test deduplication of similar issues
 * - Test severity-based sorting
 * - Test error handling (layer failures)
 * - Test layer priority and ordering
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// These imports will fail initially - that's expected in TDD!
import {
  DetectionOrchestrator,
  DetectionLayer,
  DetectionResult,
  LayerError
} from '../../../src/hallucination/integration/detection-orchestrator';

import { HallucinationIssue } from '../../../src/hallucination/types';

// Helper function to create test issues
function createTestIssue(overrides: Partial<HallucinationIssue>): HallucinationIssue {
  return {
    type: 'package-hallucination',
    severity: 'major',
    message: 'Test issue',
    location: { file: 'test.ts', line: 1 },
    confidence: 1.0,
    ...overrides
  } as HallucinationIssue;
}

describe('DetectionOrchestrator', () => {
  let orchestrator: DetectionOrchestrator;

  beforeEach(() => {
    orchestrator = new DetectionOrchestrator();
  });

  describe('Layer Registration', () => {
    it('should register detection layers', async () => {
      const layer: DetectionLayer = {
        name: 'test-layer',
        priority: 1,
        detect: async () => []
      };

      await orchestrator.registerLayer(layer);

      const layers = orchestrator.getRegisteredLayers();
      expect(layers).toHaveLength(1);
      expect(layers[0].name).toBe('test-layer');
    });

    it('should register multiple layers', async () => {
      const layer1: DetectionLayer = {
        name: 'layer-1',
        priority: 1,
        detect: async () => []
      };

      const layer2: DetectionLayer = {
        name: 'layer-2',
        priority: 2,
        detect: async () => []
      };

      await orchestrator.registerLayer(layer1);
      await orchestrator.registerLayer(layer2);

      const layers = orchestrator.getRegisteredLayers();
      expect(layers).toHaveLength(2);
    });

    it('should sort layers by priority', async () => {
      const lowPriority: DetectionLayer = {
        name: 'low',
        priority: 3,
        detect: async () => []
      };

      const highPriority: DetectionLayer = {
        name: 'high',
        priority: 1,
        detect: async () => []
      };

      await orchestrator.registerLayer(lowPriority);
      await orchestrator.registerLayer(highPriority);

      const layers = orchestrator.getRegisteredLayers();
      expect(layers[0].name).toBe('high');
      expect(layers[1].name).toBe('low');
    });

    it('should handle concurrent layer registration safely', async () => {
      const layers: DetectionLayer[] = Array.from({ length: 10 }, (_, i) => ({
        name: `layer-${i}`,
        priority: Math.floor(Math.random() * 100),
        detect: async () => []
      }));

      // Register all layers concurrently
      await Promise.all(layers.map(layer => orchestrator.registerLayer(layer)));

      const registered = orchestrator.getRegisteredLayers();
      expect(registered).toHaveLength(10);

      // Verify layers are sorted by priority
      for (let i = 1; i < registered.length; i++) {
        expect(registered[i].priority).toBeGreaterThanOrEqual(registered[i - 1].priority);
      }
    });
  });

  describe('Parallel Execution', () => {
    it('should run multiple layers in parallel', async () => {
      const layer1: DetectionLayer = {
        name: 'layer-1',
        priority: 1,
        detect: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return [];
        }
      };

      const layer2: DetectionLayer = {
        name: 'layer-2',
        priority: 2,
        detect: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return [];
        }
      };

      await orchestrator.registerLayer(layer1);
      await orchestrator.registerLayer(layer2);

      const startTime = Date.now();
      await orchestrator.detectAll('const x = 1;');
      const duration = Date.now() - startTime;

      // Should run in parallel (< 100ms), not sequential (> 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should run fast layers in under 200ms', async () => {
      const fastLayer: DetectionLayer = {
        name: 'fast',
        priority: 1,
        detect: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return [];
        }
      };

      await orchestrator.registerLayer(fastLayer);

      const startTime = Date.now();
      await orchestrator.detectFast('const x = 1;');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should track execution time', async () => {
      const layer: DetectionLayer = {
        name: 'test',
        priority: 1,
        detect: async () => []
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThan(1000);
    });

    it('should track which layers were run', async () => {
      const layer1: DetectionLayer = {
        name: 'layer-1',
        priority: 1,
        detect: async () => []
      };

      const layer2: DetectionLayer = {
        name: 'layer-2',
        priority: 2,
        detect: async () => []
      };

      await orchestrator.registerLayer(layer1);
      await orchestrator.registerLayer(layer2);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.layersRun).toContain('layer-1');
      expect(result.layersRun).toContain('layer-2');
      expect(result.layersRun).toHaveLength(2);
    });
  });

  describe('Issue Aggregation', () => {
    it('should aggregate issues from multiple layers', async () => {
      const layer1: DetectionLayer = {
        name: 'layer-1',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Issue from layer 1',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      const layer2: DetectionLayer = {
        name: 'layer-2',
        priority: 2,
        detect: async () => [
          createTestIssue({
            type: 'function-hallucination',
            severity: 'major',
            message: 'Issue from layer 2',
            location: { file: 'test.ts', line: 2 }
          })
        ]
      };

      await orchestrator.registerLayer(layer1);
      await orchestrator.registerLayer(layer2);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].message).toContain('layer 1');
      expect(result.issues[1].message).toContain('layer 2');
    });

    it('should handle empty results from layers', async () => {
      const emptyLayer: DetectionLayer = {
        name: 'empty',
        priority: 1,
        detect: async () => []
      };

      const issueLayer: DetectionLayer = {
        name: 'issues',
        priority: 2,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'major',
            message: 'Found issue',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      await orchestrator.registerLayer(emptyLayer);
      await orchestrator.registerLayer(issueLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.issues).toHaveLength(1);
    });

    it('should flatten nested issue arrays', async () => {
      const multiIssueLayer: DetectionLayer = {
        name: 'multi',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Issue 1',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'function-hallucination',
            severity: 'major',
            message: 'Issue 2',
            location: { file: 'test.ts', line: 2 }
          })
        ]
      };

      await orchestrator.registerLayer(multiIssueLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.issues).toHaveLength(2);
    });
  });

  describe('Issue Deduplication', () => {
    it('should deduplicate identical issues', async () => {
      const layer: DetectionLayer = {
        name: 'duplicate',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Same issue',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Same issue',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should deduplicate to 1 issue
      expect(result.issues).toHaveLength(1);
    });

    it('should keep issues with different locations', async () => {
      const layer: DetectionLayer = {
        name: 'different-locations',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Same message',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Same message',
            location: { file: 'test.ts', line: 2 }
          })
        ]
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should keep both (different lines)
      expect(result.issues).toHaveLength(2);
    });

    it('should keep issues with different types', async () => {
      const layer: DetectionLayer = {
        name: 'different-types',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Issue',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'function-hallucination',
            severity: 'critical',
            message: 'Issue',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should keep both (different types)
      expect(result.issues).toHaveLength(2);
    });

    it('should handle complex objects without circular reference issues', async () => {
      // Create issues with complex nested objects that could cause circular references
      const complexIssue1: HallucinationIssue = createTestIssue({
        type: 'package-hallucination',
        severity: 'critical',
        message: 'Complex issue',
        location: { file: 'test.ts', line: 1 }
      });

      const complexIssue2: HallucinationIssue = createTestIssue({
        type: 'package-hallucination',
        severity: 'critical',
        message: 'Complex issue',
        location: { file: 'test.ts', line: 1 }
      });

      // Add potentially circular metadata
      const metadata: Record<string, unknown> = { nested: {} };
      metadata.nested = metadata; // Create circular reference
      (complexIssue1 as { metadata?: unknown }).metadata = metadata;
      (complexIssue2 as { metadata?: unknown }).metadata = metadata;

      const layer: DetectionLayer = {
        name: 'complex',
        priority: 1,
        detect: async () => [complexIssue1, complexIssue2]
      };

      await orchestrator.registerLayer(layer);

      // Should not throw circular reference error
      const result = await orchestrator.detectAll('const x = 1;');

      // Should deduplicate based on primitive fields only
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('Severity-based Sorting', () => {
    it('should sort issues by severity (critical first)', async () => {
      const layer: DetectionLayer = {
        name: 'mixed-severity',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'function-hallucination',
            severity: 'minor',
            message: 'Minor issue',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'package-hallucination',
            severity: 'critical',
            message: 'Critical issue',
            location: { file: 'test.ts', line: 2 }
          }),
          createTestIssue({
            type: 'logic-hallucination',
            severity: 'major',
            message: 'Major issue',
            location: { file: 'test.ts', line: 3 }
          })
        ]
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.issues[0].severity).toBe('critical');
      expect(result.issues[1].severity).toBe('major');
      expect(result.issues[2].severity).toBe('minor');
    });

    it('should maintain order within same severity', async () => {
      const layer: DetectionLayer = {
        name: 'same-severity',
        priority: 1,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'major',
            message: 'First major',
            location: { file: 'test.ts', line: 1 }
          }),
          createTestIssue({
            type: 'function-hallucination',
            severity: 'major',
            message: 'Second major',
            location: { file: 'test.ts', line: 2 }
          })
        ]
      };

      await orchestrator.registerLayer(layer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.issues[0].message).toBe('First major');
      expect(result.issues[1].message).toBe('Second major');
    });
  });

  describe('Timeout Protection', () => {
    it('should timeout long-running layers', async () => {
      const slowLayer: DetectionLayer = {
        name: 'slow-layer',
        priority: 1,
        detect: async () => {
          // Simulate a long-running operation
          await new Promise(resolve => setTimeout(resolve, 5000));
          return [];
        }
      };

      await orchestrator.registerLayer(slowLayer);

      const result = await orchestrator.detectAll('const x = 1;', 100);

      // Should timeout and record error
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].error).toContain('exceeded timeout');
    });

    it('should allow layers to complete within timeout', async () => {
      const fastLayer: DetectionLayer = {
        name: 'fast-layer',
        priority: 1,
        detect: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return [
            createTestIssue({
              type: 'package-hallucination',
              severity: 'major',
              message: 'Found issue',
              location: { file: 'test.ts', line: 1 }
            })
          ];
        }
      };

      await orchestrator.registerLayer(fastLayer);

      const result = await orchestrator.detectAll('const x = 1;', 200);

      // Should complete successfully
      expect(result.issues).toHaveLength(1);
      expect(result.errors).toBeUndefined();
    });

    it('should use default timeout when not specified', async () => {
      const normalLayer: DetectionLayer = {
        name: 'normal-layer',
        priority: 1,
        detect: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return [];
        }
      };

      await orchestrator.registerLayer(normalLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should complete successfully with default timeout (30s)
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle layer failures gracefully', async () => {
      const failingLayer: DetectionLayer = {
        name: 'failing',
        priority: 1,
        detect: async () => {
          throw new Error('Layer failed');
        }
      };

      const workingLayer: DetectionLayer = {
        name: 'working',
        priority: 2,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'major',
            message: 'Found issue',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      await orchestrator.registerLayer(failingLayer);
      await orchestrator.registerLayer(workingLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should still get issues from working layer
      expect(result.issues).toHaveLength(1);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].layerName).toBe('failing');
    });

    it('should track layer errors', async () => {
      const errorLayer: DetectionLayer = {
        name: 'error',
        priority: 1,
        detect: async () => {
          throw new Error('Test error');
        }
      };

      await orchestrator.registerLayer(errorLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('Test error');
    });

    it('should continue execution if one layer fails', async () => {
      const layers: DetectionLayer[] = [
        {
          name: 'layer-1',
          priority: 1,
          detect: async () => {
            throw new Error('Failed');
          }
        },
        {
          name: 'layer-2',
          priority: 2,
          detect: async () => [
            createTestIssue({
              type: 'package-hallucination',
              severity: 'major',
              message: 'Issue 2',
              location: { file: 'test.ts', line: 1 }
            })
          ]
        },
        {
          name: 'layer-3',
          priority: 3,
          detect: async () => [
            createTestIssue({
              type: 'function-hallucination',
              severity: 'minor',
              message: 'Issue 3',
              location: { file: 'test.ts', line: 2 }
            })
          ]
        }
      ];

      await Promise.all(layers.map(l => orchestrator.registerLayer(l)));

      const result = await orchestrator.detectAll('const x = 1;');

      // Should get issues from layers 2 and 3
      expect(result.issues).toHaveLength(2);
      expect(result.layersRun).toContain('layer-2');
      expect(result.layersRun).toContain('layer-3');
    });
  });

  describe('Fast vs All Detection', () => {
    it('should only run fast layers in detectFast mode', async () => {
      const fastLayer: DetectionLayer = {
        name: 'fast',
        priority: 1,
        timeout: 100,
        detect: async () => [
          createTestIssue({
            type: 'package-hallucination',
            severity: 'major',
            message: 'Fast issue',
            location: { file: 'test.ts', line: 1 }
          })
        ]
      };

      const slowLayer: DetectionLayer = {
        name: 'slow',
        priority: 2,
        timeout: 5000,
        detect: async () => [
          createTestIssue({
            type: 'function-hallucination',
            severity: 'minor',
            message: 'Slow issue',
            location: { file: 'test.ts', line: 2 }
          })
        ]
      };

      await orchestrator.registerLayer(fastLayer);
      await orchestrator.registerLayer(slowLayer);

      const result = await orchestrator.detectFast('const x = 1;');

      // Should only run fast layer
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe('Fast issue');
      expect(result.layersRun).toContain('fast');
      expect(result.layersRun).not.toContain('slow');
    });

    it('should run all layers in detectAll mode', async () => {
      const fastLayer: DetectionLayer = {
        name: 'fast',
        priority: 1,
        timeout: 100,
        detect: async () => []
      };

      const slowLayer: DetectionLayer = {
        name: 'slow',
        priority: 2,
        timeout: 5000,
        detect: async () => []
      };

      await orchestrator.registerLayer(fastLayer);
      await orchestrator.registerLayer(slowLayer);

      const result = await orchestrator.detectAll('const x = 1;');

      // Should run both layers
      expect(result.layersRun).toContain('fast');
      expect(result.layersRun).toContain('slow');
    });
  });
});
