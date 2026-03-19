
import { FixStrategy, FixResult } from './index';
import { Violation } from '../../rules/schema';

export class SuggestionStrategy implements FixStrategy {
    name = 'suggestion';

    async apply(violation: Violation, params?: Record<string, unknown>): Promise<FixResult> {
        const message = params?.message as string || 'An alternative approach is recommended.';
        
        return {
            type: 'suggestion',
            content: message
        };
    }
}
