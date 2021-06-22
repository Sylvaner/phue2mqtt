export class MqttConfig {
  server: string = 'localhost';
  login: string = '';
  password: string = '';
  port: number = 1883;
  useTls: boolean = false;

  /**
   * Read MQTT config from JSON
   *
   * @param config Readed config
   */
    public static parseFromJson(config: any): MqttConfig {
    const mqttConfig = new MqttConfig();
    if (config.server !== undefined) {
      mqttConfig.server = config.server;
    }
    if (config.login !== undefined) {
      mqttConfig.login = config.login;
    }
    if (config.password !== undefined) {
      mqttConfig.password = config.password;
    }
    if (config.port !== undefined) {
      mqttConfig.port = config.port;
    }
    if (config.useTls !== undefined) {
      mqttConfig.useTls = config.useTls;
    }
    return mqttConfig
  }
}