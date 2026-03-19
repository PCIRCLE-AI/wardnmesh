
import { Rule, Violation } from '../rules/schema';
import { FixStrategy, FixResult } from './strategies';
import { SuggestionStrategy } from './strategies/suggestion';

export class AutofixService {
    private static instance: AutofixService;
    private strategies: Map<string, FixStrategy> = new Map();

    private constructor() {
        this.registerStrategy(new SuggestionStrategy());
    }

    public static getInstance(): AutofixService {
        if (!AutofixService.instance) {
            AutofixService.instance = new AutofixService();
        }
        return AutofixService.instance;
    }

    public registerStrategy(strategy: FixStrategy) {
        this.strategies.set(strategy.name, strategy);
    }

    public async resolve(violation: Violation, rule: Rule): Promise<FixResult | null> {
        if (!rule.autofix || !rule.autofix.enabled) {
            return null;
        }

        const strategy = this.strategies.get(rule.autofix.strategy);
        if (!strategy) {
            console.warn(`[AutofixService] Strategy '${rule.autofix.strategy}' not found for rule ${rule.id}`);
            return null;
        }

        try {
            return await strategy.apply(violation, rule.autofix.params);
        } catch (error) {
            console.error(`[AutofixService] Failed to apply fix for ${rule.id}:`, error);
            return null;
        }
    }
}
