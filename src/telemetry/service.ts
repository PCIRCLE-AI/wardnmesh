/**
 * TelemetryService — No-op stub
 *
 * All telemetry has been removed for the standalone open-source version.
 * This stub preserves the public interface so existing callers don't break.
 */

import { BaseTelemetryEvent } from './interfaces';

export class TelemetryService {
  private static instance: TelemetryService;

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public updateConfig(_enabled: boolean): void {}

  public getAnonymousId(): string {
    return 'local';
  }

  public isEnabled(): boolean {
    return false;
  }

  public track(_event: BaseTelemetryEvent): void {}

  public async shutdown(): Promise<void> {}
}
