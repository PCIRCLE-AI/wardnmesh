import * as fs from 'fs';
import * as path from 'path';
import { Rule, DetectorConfig, ContentAnalysisDetectorConfig } from './schema';
import { validateRule } from './validator';
import { getCachedRegex } from '../utils/safe-regex';

export class DynamicRuleLoader {
  private watcher: fs.FSWatcher | null = null;
  private currentPath: string | null = null;

  /**
   * Load rules from a JSON file
   * @param filePath Path to the JSON file
   * @returns Array of parsed Rule objects
   */
  public loadFromFile(filePath: string): Rule[] {
    try {
      if (!fs.existsSync(filePath)) {
        // It's okay if the file doesn't exist, just return empty
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const rawRules = JSON.parse(content);

      if (!Array.isArray(rawRules)) {
        console.warn('[DynamicRuleLoader] Invalid format: Root must be an array');
        return [];
      }

      const parsedRules: Rule[] = [];
      
      for (const raw of rawRules) {
        try {
          const rule = this.parseRule(raw);
          parsedRules.push(rule);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message :String(e);
          console.error(`[DynamicRuleLoader] Failed to parse rule ${raw.id}: ${message}`);
        }
      }

      return parsedRules;

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[DynamicRuleLoader] Error loading file ${filePath}: ${message}`);
      return [];
    }
  }

  /**
   * Watch a file for changes and reload rules
   * @param filePath Path to the JSON file
   * @param callback Callback function with new rules
   */
  public watchFile(filePath: string, callback: (rules: Rule[]) => void) {
    if (this.watcher) {
      this.watcher.close();
    }

    this.currentPath = filePath;

    // Initial load
    const initialRules = this.loadFromFile(filePath);
    if (initialRules.length > 0) {
        callback(initialRules);
    }

    try {
      // Create watcher if directory exists, otherwise we can't watch
      // Ideally we watch the directory if the file doesn't exist yet, 
      // but for simplicity we'll assume the user might create it or we watch if it exists.
      // If it doesn't exist, we can try to watch the dir, but let's stick to watching the file if it exists
      // or polling if needed. For now, simple fs.watch on the file if it exists.
      
      if (fs.existsSync(filePath)) {
         this.setupWatcher(filePath, callback);
      } else {
         // Watch directory for file creation? 
         // For MVP, enable watch only if file exists or just log warning.
         // Let's watch the parent dir for creation events.
         const dir = path.dirname(filePath);
         if (fs.existsSync(dir)) {
             console.log(`[DynamicRuleLoader] Watching directory ${dir} for ${path.basename(filePath)} creation`);
             this.watcher = fs.watch(dir, (eventType, filename) => {
                 if (filename === path.basename(filePath)) {
                     // If file created or changed
                     this.handleFileChange(filePath, callback);
                 }
             });
         }
      }
    } catch (e) {
      console.error('[DynamicRuleLoader] Setup watch failed:', e);
    }
  }
  
  private setupWatcher(filePath: string, callback: (rules: Rule[]) => void) {
      try {
        this.watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change' || eventType === 'rename') {
                this.handleFileChange(filePath, callback);
            }
        });
      } catch {
          // ignore
      }
  }

  private isReloading = false;
  private handleFileChange(filePath: string, callback: (rules: Rule[]) => void) {
      if (this.isReloading) return;
      this.isReloading = true;
      
      // Debounce slightly
      setTimeout(() => {
          if (fs.existsSync(filePath)) {
             console.log('[DynamicRuleLoader] Reloading rules...');
             const rules = this.loadFromFile(filePath);
             callback(rules);
             
             // Re-attach watcher if 'rename' event (vim/editors often do atomic rename)
             if (this.watcher) this.watcher.close();
             this.setupWatcher(filePath, callback);
          }
          this.isReloading = false;
      }, 100);
  }

  public stop() {
    if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
    }
  }

  private parseRule(raw: unknown): Rule {
    // 1. Run schema validation
    const validated = validateRule(raw);

    // 2. Hydrate/Convert objects (RegExp, etc)
    const rule: Rule = {
      ...validated,
      detector: {
        type: validated.detector.type,
        config: this.parseDetectorConfig(validated.detector.type, validated.detector.config)
      }
    };

    return rule;
  }


  private parseDetectorConfig(type: string, config: unknown): DetectorConfig {
      // Deep copy to avoid mutating raw
      const finalConfig = JSON.parse(JSON.stringify(config));

      if (type === 'content_analysis') {
         const caConfig = finalConfig as ContentAnalysisDetectorConfig;

         // SECURITY FIX Round 15: Use getCachedRegex for ReDoS protection
         // Convert string patterns to RegExp with validation
         if (Array.isArray(finalConfig.suspiciousPatterns)) {
             caConfig.suspiciousPatterns = finalConfig.suspiciousPatterns
                 .map((p: string) => getCachedRegex(p))
                 .filter((r): r is RegExp => r !== null); // Filter out invalid patterns
         }
         if (Array.isArray(finalConfig.validPatterns)) {
             caConfig.validPatterns = finalConfig.validPatterns
                 .map((p: string) => getCachedRegex(p))
                 .filter((r): r is RegExp => r !== null); // Filter out invalid patterns
         }
         return caConfig;
      }



      return finalConfig;
  }
}
