
import * as fs from 'fs';
import * as path from 'path';
import { MALICIOUS_PACKAGES } from './signatures';

export interface ScanResult {
    safe: boolean;
    issues: string[];
}

export class DependencyAnalyzer {
    
    /**
     * Scan current directory for malicious dependencies
     */
    static async scan(cwd: string): Promise<ScanResult> {
        const issues: string[] = [];
        
        // 1. Check package.json
        const packageJsonPath = path.join(cwd, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const content = fs.readFileSync(packageJsonPath, 'utf8');
                const pkg = JSON.parse(content);
                const allDeps = { 
                    ...(pkg.dependencies || {}), 
                    ...(pkg.devDependencies || {}),
                    ...(pkg.peerDependencies || {})
                };
                
                for (const dep of Object.keys(allDeps)) {
                    if (MALICIOUS_PACKAGES.has(dep)) {
                        issues.push(`Malicious npm package detected: ${dep}`);
                    }
                }
            } catch (e) {
                console.warn('[DependencyAnalyzer] Failed to parse package.json', e);
            }
        }

        // 2. Check requirements.txt (Python) - placeholder for now
        // ...

        return {
            safe: issues.length === 0,
            issues
        };
    }
}
