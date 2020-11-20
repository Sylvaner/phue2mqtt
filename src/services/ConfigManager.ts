import fs from 'fs';
import path from 'path';
import { MqttConfig } from '../models/MqttConfig';
import { HueConfig } from '../models/HueConfig';

export class ConfigManager {
  private mqttConfig: MqttConfig;
  private hueConfig: HueConfig;
  private configDirectory: string;

  constructor() {
    this.mqttConfig = new MqttConfig();
    this.hueConfig = new HueConfig();
    this.configDirectory = '';
  }

  /**
   * Read json file content
   *
   * @param filepath File path
   *
   * @returns Readed data
   */
  private readJsonFile(filepath: string) {
    const fileContent = fs.readFileSync(filepath);
    const rawContent = fileContent.toString();
    return JSON.parse(rawContent);
  }

  /**
   * Read MQTT config from global config
   *
   * @remarks Test keys
   *
   * @param config Global config
   *
   * @returns True on success
   */
  private parseMqttConfig(config: any): boolean {
    if (!config.hasOwnProperty('mqtt')) {
      console.error('MQTT: configuration not found');
      return false;
    }
    for (const configKeys of Object.keys(this.mqttConfig)) {
      if (config.mqtt.hasOwnProperty(configKeys)) {
        // @ts-ignore
        this.mqttConfig[configKeys] = config.mqtt[configKeys];
      } else {
        console.error(`MQTT: Missing ${configKeys} configuration key.`);
        return false;
      }
    }
    return true;
  }

  /**
   * Read Hue config from global config
   *
   * @remarks Global config is priority on hue config file.
   *
   * @param config Global config
   *
   * @returns True on success
   */
  private parseHueConfig(config: any): boolean {
    if (!config.hasOwnProperty('hue')) {
      console.error('HUE: configuration not found');
      return false;
    }
    if (config.hue.discover !== undefined &&
      config.hue.discover === false &&
      config.hue.gateway === undefined &&
      config.hue.gateway === '') {
      console.error('HUE: Disabled discover and no gateway specified');
      return false;
    }
    // Read global config
    if (config.hue.pollingInterval !== undefined) {
      this.hueConfig.pollingInterval = config.hue.pollingInterval;
    }
    if (config.hue.clientId !== undefined) {
      this.hueConfig.clientId = config.hue.clientId;
    }
    if (config.hue.discover !== undefined) {
      this.hueConfig.discover = config.hue.discover;
    }
    // If username, clientKey and gateway is specified, doesn't need to sync
    if (config.hue.username !== undefined) {
      this.hueConfig.username = config.hue.username;
    }
    if (config.hue.clientKey !== undefined) {
      this.hueConfig.clientKey = config.hue.clientKey;
    }
    if (config.hue.gateway !== undefined) {
      this.hueConfig.gateway = config.hue.gateway;
    }
    // Check if config was saved on previous launch
    // if gateway is already define from global config, file is ignored
    if (fs.existsSync(`${this.configDirectory}/hue.json`) && this.hueConfig.gateway === '') {
      const savedConfig = this.readJsonFile(`${this.configDirectory}/hue.json`);
      this.hueConfig.username = savedConfig.username;
      this.hueConfig.clientKey = savedConfig.clientKey;
      this.hueConfig.gateway = savedConfig.gateway;
    }
    return true;
  }

  /**
   * Save hue on specific file when gateway is synced
   *
   * @param hueData Data to save with credentials
   */
  public saveHueData(hueData: object): void {
    console.log(hueData);
    const hueFileContent = JSON.stringify(hueData);
    fs.writeFile(`${this.configDirectory}/hue.json`, hueFileContent, () => {
      console.log(`HUE: Data saved ${this.configDirectory}/hue.json`)
    });
  }


  /**
   * Read global config file
   *
   * @param configPath Global config file path
   *
   * @returns True on success
   */
  public readGlobalConfig(configPath: string): boolean {
    if (fs.existsSync(configPath)) {
      this.configDirectory = path.dirname(fs.realpathSync(configPath))
      const config = this.readJsonFile(configPath);
      if (!this.parseMqttConfig(config)) {
        return false;
      }
      if (!this.parseHueConfig(config)) {
        return false;
      }
    }
    else {
      console.error(`Config file ${configPath} not found.`);
    }
    return true;
  }

  /**
   * Obtain MQTT configuration
   *
   * @returns MQTT configuration
   */
  public getMqttConfig(): MqttConfig {
    return this.mqttConfig;
  }

  /**
   * Obtain Hue configuration
   *
   * @returns Hue configuration
   */
  public getHueConfig(): HueConfig {
    return this.hueConfig;
  }
}