export class RequestContext {
  constructor(
    public readonly correlationId: string,
    public readonly requestStartTime: Date,
    public readonly userContext?: {
      userId: string;
      municipalityId: string;
      role: string;
    }
  ) {}

  get latencyMs(): number {
    return new Date().getTime() - this.requestStartTime.getTime();
  }
}
