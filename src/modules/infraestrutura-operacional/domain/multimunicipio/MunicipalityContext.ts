export class MunicipalityContext {
  constructor(
    public readonly municipalityId: string,
    public readonly timezone: string,
    public readonly aggregationScope: string
  ) {}
}
