import fs from 'fs';
import path from 'path';
import { MqttConfig } from '../models/MqttConfig';
import { HueConfig } from '../models/HueConfig';

type GlobalConfig = {
  mqtt: MqttConfig,
  hue: HueConfig,
  debug: boolean
}

export class ConfigManager {
  private config: GlobalConfig;
  private configDirectory: string;
  private debug: boolean;

  constructor() {
    this.config = {
      mqtt: new MqttConfig(),
      hue: new HueConfig(),
      debug: false
    };
    this.configDirectory = '';
    this.debug = false;
  }

  /**
   * Save hue on specific file when gateway is synced
   *
   * @param hueData Data to save with credentials
   */
  public saveHueData(hueData: any): void {
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
      const rawConfig = this.readJsonFile(configPath);
      this.config  = this.parseRawConfig(rawConfig);
    }
    else {
      console.error(`Config file ${configPath} not found.`);
    }
    return true;
  }

  /**
   * Read json file content
   *
   * @param filepath File path
   *
   * @returns Readed data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readJsonFile(filepath: string): any {
    const fileContent = fs.readFileSync(filepath);
    const rawContent = fileContent.toString();
    return JSON.parse(rawContent);
  }

  /**
   * Read config type safety
   * 
   * @param rawConfig Data readed from JSON file
   * @returns Typed data
   */
  private parseRawConfig(rawConfig: any): GlobalConfig {
    if (!Object.prototype.hasOwnProperty.call(rawConfig, 'mqtt')) {
      throw new Error('MQTT: configuration not found');
    }
    if (!Object.prototype.hasOwnProperty.call(rawConfig, 'hue')) {
      throw new Error('HUE: configuration not found');
    }
    const globalConfig: GlobalConfig = {
      mqtt: MqttConfig.parseFromJson(rawConfig.mqtt),
      hue: HueConfig.parseFromJson(rawConfig.hue),
      debug: false
    }
    // @TODO: A déplacer
    // Check if config was saved on previous launch
    // if gateway is already define from global config, file is ignored
    if (fs.existsSync(`${this.configDirectory}/hue.json`) && globalConfig.hue.gateway === '') {
      const savedConfig = this.readJsonFile(`${this.configDirectory}/hue.json`);
      globalConfig.hue.username = savedConfig.username;
      globalConfig.hue.clientKey = savedConfig.clientKey;
      globalConfig.hue.gateway = savedConfig.gateway;
    }
    if (Object.prototype.hasOwnProperty.call(rawConfig, 'debug')) {
      globalConfig.debug = rawConfig.debug;
    }
    return globalConfig;
  }

  /**
   * Obtain MQTT configuration
   *
   * @returns MQTT configuration
   */
  public getMqttConfig(): MqttConfig {
    return this.config.mqtt;
  }

  /**
   * Obtain Hue configuration
   *
   * @returns Hue configuration
   */
  public getHueConfig(): HueConfig {
    return this.config.hue;
  }

  /**
   * Obtain debug mode state
   * 
   * @returns Debug mode state
   */
  public getDebugMode(): boolean {
    return this.debug;
  }
}