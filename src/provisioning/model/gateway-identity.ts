export class GatewayIdentity {
  constructor(
    public readonly gatewayId: string,
    public readonly tenantId: string,
  ) {}
}
