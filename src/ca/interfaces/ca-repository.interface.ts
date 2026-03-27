import { CAMaterial } from '../model/ca-material';

export interface CARepository {
  load(): Promise<CAMaterial>; //carica key e cert
  initialize(): Promise<CAMaterial>; //inizializzare key e cert
  caExists(): Promise<boolean>; //verificare se esiste la key e cert
}
