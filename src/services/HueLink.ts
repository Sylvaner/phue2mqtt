import Hue from 'node-hue-api';
import Api from 'node-hue-api/lib/api/Api';
import { HueConfig } from "../models/HueConfig";
import { MqttConnector } from './MqttConnector';

const APP_NAME = 'PHUE2MQTT';

export class HueLink {
  private config: HueConfig;
  private apiLink!: Api;
  private commandTopic: RegExp = /^phue\/(.*?)\/(.*?)\/set/;
  private cache: any = {
    lights: {},
    groups: {},
    sensors: {}
  };
  private hashCache: any = {
    lights: {},
    groups: {},
    sensors: {}
  }
  private mqttConnector: MqttConnector;
  private debug: boolean;

  constructor(config: HueConfig, mqttConnector: MqttConnector, debug: boolean) {
    this.config = config;
    this.mqttConnector = mqttConnector;
    this.debug = debug;
  }

  /**
   * Get synced status
   *
   * @remarks Synced but not necessary connected
   *
   * @returns True if synced
   */
  public isSynced(): boolean {
    return this.config.username !== '' && this.config.gateway !== '' && this.config.clientKey !== '';
  }

  /**
   * Get status if gateway has been found
   *
   * @returns True if gateway founded
   */
  public gatewayFound(): boolean {
    return this.config.gateway !== '';
  }

  /**
   * Discover gateway for future connection
   *
   * @param resultCallback Function called when gateway found
   */
  public async discover(resultCallback?: () => void) {
    const discoveryResults = await Hue.v3.discovery.nupnpSearch();
    if (discoveryResults.length > 0) {
      // TODO: Multiple gateway
      this.config.gateway = discoveryResults[0].ipaddress;
    } else {
      console.error('HUE: Gateway not found');
    }
    if (resultCallback) {
      resultCallback();
    }
}

  /**
   * Try sync if button gateway is pressed
   *
   * @param resultCallback Function called on sync with empty data on fail or credentials on success
   */
  public async tryToSync(resultCallback?: (dataToSave: object) => void) {
    // Connect with unauthenticated process
    const unauthenticatedApi = await Hue.v3.api.createLocal(this.config.gateway).connect();

    let dataToSave = {};
    try {
      const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, this.config.clientId);
      console.log(`HUE: User created, username: ${createdUser.username}, clientKey: ${createdUser.clientkey}`);
      this.config.username = createdUser.username;
      this.config.clientKey = createdUser.clientkey;
      dataToSave = {
        username: this.config.username,
        clientKey: this.config.clientKey,
        gateway: this.config.gateway
      }
    } catch (error) {
      if (error.getHueErrorType() === 101) {
        console.error('HUE: Press the Link button.');
      } else {
        console.error(`HUE: Error: ${error.message}`);
      }
    }
    if (resultCallback) {
      resultCallback(dataToSave);
    }
  }

  /**
   * Connect to gateway
   *
   * @remarks Request groups for connection test
   *
   * @param callbackFunc Function called on connection success
   */
  public async connect(callbackFunc: () => void) {
    try {
      this.apiLink = await Hue.v3.api.createLocal(this.config.gateway).connect(this.config.username);
      // Test if link works
      await this.apiLink.groups.getAll();
      console.log('HUE: Connected');
      if (callbackFunc) {
        callbackFunc();
      }
    } catch (error) {
      console.log(`HUE: ${error.message}`);
    }
  }

  /**
   * Get topic for message handler
   *
   * @returns Topic message
   */
  public getTopicToSubscribe(): string {
    return 'phue/+/+/set';
  }

  /**
   * Parse message from MQTT
   *
   * @param topic Source topic
   * @param rawData Message data
   */
  public parseMessage(topic: string, rawData: string): void {
    try {
      // Extract informations from topic with regex
      const topicData = this.commandTopic.exec(topic);
      const data = JSON.parse(rawData.toString());
      const dataKeys = Object.keys(data);
      if (topicData !== null && topicData.length > 2 && dataKeys.length > 0) {
        const deviceType = topicData[1];
        const deviceId = topicData[2];
        // Test if device type, device and state to change exists
        if (this.cache.hasOwnProperty(deviceType) &&
          this.cache[deviceType].hasOwnProperty(deviceId) &&
          this.cache[deviceType][deviceId].state.hasOwnProperty(dataKeys[0])) {
          // Call specific method depends of device type
          if (deviceType === 'lights') {
            this.apiLink.lights.setLightState(deviceId, data);
          } else if (deviceType === 'groups') {
            this.apiLink.groups.setGroupState(deviceId, data);
          }
        }
      }
    } catch (error) {
      console.error(`HUE: Error on received message ${rawData.toString()}`);
    }
  }

  /**
   * Publish all devices on MQTT
   *
   * @remarks Create cache for prevent update without change
   */
  public async publishAllDevices() {
    const deviceTypes = ['lights', 'groups', 'sensors'];
    for (const deviceType of deviceTypes) {
      this.cache[deviceType] = {};
      // @ts-ignore
      const devices = await this.apiLink[deviceType].getAll();
      for (const device of devices) {
        let state;
        if (deviceType === 'groups') {
          state = device.getHuePayload().action;
        } else {
          state = device.getHuePayload().state;
        }
        this.cache[deviceType][device.id] = {
          id: device.id,
          name: device.name,
          state,
          model: device.getHuePayload().modelid
        }
        this.publishToMqtt(deviceType, device.id, this.cache[deviceType][device.id]);
        // Comparaison on state stringified
        this.hashCache[deviceType][device.id] = JSON.stringify(state);
      }
    }
  }

  /**
   * Event loop
   */
  public async start() {
    console.log('HUE: Start event loop');
    setInterval(async () => {
      const deviceTypes = ['lights', 'groups', 'sensors'];
      for (const deviceType of deviceTypes) {
        // @ts-ignore
        const devices = await this.apiLink[deviceType].getAll();
        for (const device of devices) {
          let state;
          if (deviceType === 'groups') {
            state = device.getHuePayload().action;
          } else {
            state = device.getHuePayload().state;
          }
          // Test if update is necessary
          const hash = JSON.stringify(state);
          if (this.hashCache[deviceType][device.id] !== hash) {
            this.cache[deviceType][device.id].state = state;
            this.hashCache[deviceType][device.id] = hash;
            this.publishToMqtt(deviceType, device.id, this.cache[deviceType][device.id]);
            if (this.debug) {
              console.log(`Update ${deviceType}: ${this.cache[deviceType][device.id].name} (${device.id})`);
              console.log(state);
            }
          }
        }
      }
    }, this.config.pollingInterval * 1000);
  }

  /**
   * Publish to Mqtt topic
   * 
   * @param mqttConnector Mqtt connector
   * @param deviceType Type of the device
   * @param deviceId Id of the device
   * @param state New state
   */
  private publishToMqtt(deviceType: string, deviceId: string, state: Object): void {
    this.mqttConnector.publish(`phue/${deviceType}/${deviceId}`, state);
  }
}