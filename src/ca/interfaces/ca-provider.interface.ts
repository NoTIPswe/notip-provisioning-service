import { CAMaterial } from '../model/ca-material';

export interface CAProvider {
  getCA(): CAMaterial;
}
