import Hue from 'node-hue-api';
import Api from 'node-hue-api/lib/api/Api';
import { HueConfig } from "../models/HueConfig";
import { MqttConnector } from './MqttConnector';
import {DeviceProperty} from "../models/DeviceProperty";
import {CachedDevice} from "../models/CachedDevice";

const APP_NAME = 'PHUE2MQTT';

export class HueLink {
  private config: HueConfig;
  private apiLink!: Api;
  private commandTopic: RegExp = /^homie\/(.*?)-(.*?)\/(.*?)\/(.*)$/;
  private cache: {[key: string]: CachedDevice} = {}
  private mqttConnector: MqttConnector;
  private debug: boolean;
  private refreshInterval?: NodeJS.Timeout;
  private managedProperties: { [key: string]: DeviceProperty; } = {
    'on': {
      '$name': 'On',
      '$datatype': 'boolean',
      '$settable': 'true'
    },
    'bri': {
      '$name': 'Brightness',
      '$datatype': 'integer',
      '$settable': 'true',
      '$format': '1:254'
    },
    'ct': {
      '$name': 'Color temperature',
      '$datatype': 'integer',
      '$settable': 'true',
      '$format': '153:500'
    },
    'status': {
      '$name': 'Status',
      '$datatype': 'integer',
      '$settable': 'false'
    },
    'buttonevent': {
      '$name': 'Button event',
      '$datatype': 'integer',
      '$settable': 'false'
    },
    'battery': {
      '$name': 'Battery',
      '$datatype': 'integer',
      '$unit': '%',
      '$settable': 'false'
    },
    'lastupdated': {
      '$name': 'Last updated',
      '$datatype': 'datetime',
      '$settable': 'true'
    }
  }

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
  public async tryToSync(resultCallback?: (dataToSave: any) => void) {
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
  public connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        Hue.v3.api.createLocal(this.config.gateway).connect(this.config.username).then((hueApi) => {
          this.apiLink = hueApi;
          // Test if link works
          this.apiLink.groups.getAll().then(() => {
            console.log('HUE: Connected');
            resolve();
            }).catch(() => reject());
        }).catch((error: Error) => {
          console.error(`HUE: ${error.message}`);
          reject()
        });
        /*
        if (callbackFunc) {
          callbackFunc();
        }
        */
    });
  }

  /**
   * Get topic for message handler
   *
   * @returns Topic message
   */
  public getTopicToSubscribe(): string {
    return 'homie/+/+/#';
  }

  /**
   * Transform raw message from string to the best type
   *
   * @param rawData Data from message
   *
   * @return Transformed data
   */
  private static prepareMessageData(rawData: string): any {
    let data: any = rawData
    if (/^\d+$/.test(rawData)) {
      data = parseInt(rawData, 10);
    } else if (rawData === 'true') {
      data = true;
    } else if (rawData === 'false') {
      data = false;
    }
    return data;
  }

  /**
   * Parse message from MQTT
   *
   * @param topic Source topic
   * @param rawData Message data
   */
  public async parseMessage(topic: string, rawData: string) {
      // Extract informations from topic with regex
      const topicData = this.commandTopic.exec(topic);
      const data: any = HueLink.prepareMessageData(rawData.toString());
      if (topicData !== null && topicData.length > 2) {
        const deviceType = topicData[1];
        const deviceId = topicData[2];
        const targetProperty = topicData[4];
        const rawDeviceId = `${deviceType}-${deviceId}`;
        // Test if device type, device and state to change exists
        if (Object.prototype.hasOwnProperty.call(this.cache, rawDeviceId) &&
            Object.prototype.hasOwnProperty.call(this.cache[rawDeviceId].state, targetProperty) &&
            this.cache[rawDeviceId].state[targetProperty] !== data) {
          // Call specific method depends of device type
          const parsedData: any = {};
          parsedData[targetProperty] = data;
          this.cache[rawDeviceId].state[targetProperty] = data;
          try {
            if (deviceType === 'lights') {
              await this.apiLink.lights.setLightState(deviceId, parsedData);
            } else if (deviceType === 'groups') {
              await this.apiLink.groups.setGroupState(deviceId, parsedData);
            }
          } catch (error) {
            console.error(`HUE: Error on received message ${topic} - ${rawData.toString()} : ${error.message}`);
          }
        }
      }
  }

  /**
   * Publish all device properties
   *
   * @param deviceId Mqtt device id (lights-2)
   * @param deviceType Type of the device
   * @param deviceState State data
   *
   * @return True if device have managed property
   */
  public publishProperties(deviceId: string, deviceType: string, deviceState: any): boolean {
    const properties = Object.keys(deviceState).filter((stateId) => { return this.managedProperties[stateId] !== undefined; });
    if (properties.length > 0) {
      // Publish list of properties
      this.publishToMqtt(`${deviceId}/${deviceType}/$properties`, properties.join(','));
      for (const propertyName of properties) {
        if (Object.prototype.hasOwnProperty.call(deviceState, propertyName)) {
          this.publishToMqtt(`${deviceId}/${deviceType}/${propertyName}`, deviceState[propertyName]);
          this.cache[deviceId].state[propertyName] = deviceState[propertyName];
          for (const propertyInfo of Object.keys(this.managedProperties[propertyName])) {
            this.publishToMqtt(`${deviceId}/${deviceType}/${propertyName}/${propertyInfo}`, this.managedProperties[propertyName][propertyInfo]);
          }
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Obtain state data of a device
   *
   * @param deviceType Device type
   * @param device Device data
   *
   * @return Object with all informations
   */
  private static getStateFromDevice(deviceType: string, device: any): {[key: string]: string} {
    let state;
    switch (deviceType) {
      case 'lights':
        state = device.getHuePayload().state;
        break;
      case 'groups':
        state = device.getHuePayload().action;
        break;
      case 'sensors':
      default:
        state = {...device.getHuePayload().state, ...device.getHuePayload().config}
        break;
    }
    return state
  }

  /**
   * Publish all devices on MQTT
   *
   * @remarks Create cache for prevent update without change
   */
  public async publishAllDevices(callbackFunc:() => void) {
    const deviceTypes: {[key: string]: string} = {
      'lights': 'Lights',
      'groups': 'Groups',
      'sensors': 'Sensors'
    };
    for (const deviceType of Object.keys(deviceTypes)) {
      // @ts-ignore
      const devices = await this.apiLink[deviceType].getAll();
      for (const device of devices) {
        // Transform to Homie convention: https://homieiot.github.io/
        // state in homie => reachable
        let deviceState = 'ready';
        const state = HueLink.getStateFromDevice(deviceType, device);
        const devicePayload = device.getHuePayload();
        const deviceId = `${deviceType}-${devicePayload.id}`;

        if (Object.prototype.hasOwnProperty.call(state, 'reachable') && !state.reachable) {
          deviceState = 'disconnected';
        }
        this.publishToMqtt(`${deviceId}/${deviceType}/$name`, deviceTypes[deviceType]);
        this.cache[deviceId] = {
          id: devicePayload.id,
          name: device.name,
          state: {},
          model: device.getHuePayload().modelid
        }
        if (!this.publishProperties(deviceId, deviceType, state)) {
          console.warn(`Device ${devicePayload.name} has no property managed by Phue2mqtt`);
        }
        this.publishToMqtt(`${deviceId}/$homie`, '4.0');
        this.publishToMqtt(`${deviceId}/$name`, devicePayload.name);
        this.publishToMqtt(`${deviceId}/$state`, deviceState);
        this.publishToMqtt(`${deviceId}/$nodes`, deviceType);
        if (this.debug) {
          console.log(` - Published ${device.name} - ${deviceId}`);
        }
      }
    }
    console.log('HUE: Devices published');
    if (callbackFunc !== undefined) {
      callbackFunc();
    }
  }

  /**
   * Event loop
   */
  public async start() {
    console.log('HUE: Start event loop');
    this.refreshInterval = setInterval(async () => {
      const deviceTypes = ['lights', 'groups', 'sensors'];
      for (const deviceType of deviceTypes) {
        // @ts-ignore
        const devices = await this.apiLink[deviceType].getAll();
        for (const device of devices) {
          const state = HueLink.getStateFromDevice(deviceType, device);
          const deviceId = `${deviceType}-${device.id}`;
          for (const propertyName of Object.keys(this.cache[deviceId].state)) {
            if (state[propertyName] !== this.cache[deviceId].state[propertyName]) {
              if (this.debug) {
                console.log(` - Change published ${deviceId} -> ${propertyName}: ${state[propertyName]}`)
              }
              this.cache[deviceId].state[propertyName] = state[propertyName];
              this.mqttConnector.publish(`${deviceId}/${deviceType}/${propertyName}`, state[propertyName]);
            }
          }
        }
      }
    }, this.config.pollingInterval * 1000);
  }

  /**
   * Stop HUE refresh loop
   */
  public stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Publish to Mqtt topic
   *
   * @param topic MQTT topic
   * @param data Data to publish
   */
  private publishToMqtt(topic: string, data: any): void {
    this.mqttConnector.publish(`homie/${topic}`, data);
  }
}
