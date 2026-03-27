export class FactoryCredentials {
  constructor(
    public readonly factoryId: string, //identificatore opaco
    public readonly factoryKey: string, //one-time secret
  ) {}
}
