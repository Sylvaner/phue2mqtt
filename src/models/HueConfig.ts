export class HueConfig {
  discover: boolean = true;
  gateway: string = '';
  username: string = '';
  clientKey: string = '';
  clientId: string = 'phue2mqtt';
  pollingInterval: number = 2;
  synced: boolean = false;
};