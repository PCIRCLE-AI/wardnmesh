
import { Violation } from '../../rules/schema';

export interface FixResult {
    type: 'suggestion' | 'action';
    content: string; // The suggestion text or the command to run
}

export interface FixStrategy {
    name: string;
    apply(violation: Violation, params?: Record<string, unknown>): Promise<FixResult>;
}
