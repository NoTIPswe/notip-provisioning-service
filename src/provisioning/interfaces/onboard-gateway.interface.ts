import { ProvisioningRequest } from '../model/provisioning-request';
import { ProvisioningResult } from '../model/provisioning-result';

export interface OnboardGateway {
  onboard(request: ProvisioningRequest): Promise<ProvisioningResult>;
}
