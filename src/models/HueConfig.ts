export class HueConfig {
  discover: boolean = true;
  gateway: string = '';
  username: string = '';
  clientKey: string = '';
  clientId: string = 'phue2mqtt';
  pollingInterval: number = 2;
  synced: boolean = false;

  /**
   * Read Hue config from JSON
   *
   * @param config Readed config
   */
  public static parseFromJson(config: any): HueConfig {
    const hueConfig = new HueConfig();
    if (config.discover !== undefined &&
      config.discover === false &&
      config.gateway === undefined &&
      config.gateway === '') {
      throw new Error('HUE: Disabled discover and no gateway specified');
    }
    // Read global config
    if (config.pollingInterval !== undefined) {
      hueConfig.pollingInterval = config.pollingInterval;
    }
    if (config.clientId !== undefined) {
      hueConfig.clientId = config.clientId;
    }
    if (config.discover !== undefined) {
      hueConfig.discover = config.discover;
    }
    // If username, clientKey and gateway is specified, doesn't need to sync
    if (config.username !== undefined) {
      hueConfig.username = config.username;
    }
    if (config.clientKey !== undefined) {
      hueConfig.clientKey = config.clientKey;
    }
    if (config.gateway !== undefined) {
      hueConfig.gateway = config.gateway;
    }
    return hueConfig;
  }
}