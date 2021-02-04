export interface CachedDevice {
  id: string;
  name: string;
  state: {[key: string]: string};
  model: string;
}