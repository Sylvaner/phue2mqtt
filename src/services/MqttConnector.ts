import mqtt from 'mqtt';
import { MqttConfig } from '../models/MqttConfig';

export class MqttConnector {
  private config: MqttConfig;
  private connected: boolean;
  private mqttClient!: mqtt.Client;
  private messageParser!: (topic: string, data: string) => void;

  constructor(config: MqttConfig) {
    this.config = config;
    this.connected = false;
  }

  /**
   * Get connection state
   *
   * @returns Connection state
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to MQTT server and initialise events listeners
   *
   * @param connectionCallback Function called when connection established
   */
  public connect(connectionCallback?: () => void, disconnectionCallback?: () => void): void {
    let protocol = 'mqtt';
    if (this.config.useTls) {
      protocol = protocol + 's';
    }
    this.mqttClient = mqtt.connect(`${protocol}://${this.config.server}`, {
      username: this.config.login,
      password: this.config.password,
      port: this.config.port
    });
    this.mqttClient.on('error', (e) => {
      if (e.message.indexOf('Connection refused') >= 0) {
        console.error('MQTT: connection failed');
        this.connected = false;
        this.mqttClient.end(true, {}, disconnectionCallback);
      } else if (e.message.indexOf('connect ECONNREFUSED') >= 0) {
        console.error('MQTT: Server unreachable');
        this.connected = false;
        this.mqttClient.end(true, {}, disconnectionCallback);
      } else {
        console.error(e);
      }
    });
    this.mqttClient.on('connect', () => {
      console.log('MQTT: Connected');
      this.connected = true;
      if (connectionCallback) {
        connectionCallback();
      }
    });
    // Retry to connect every 10 secondes
    this.mqttClient.on('disconnect', () => {
      this.connected = false;
      this.mqttClient.end(true, {}, disconnectionCallback);
    });
    this.mqttClient.on('message', (topic: string, message: string) => {
      if (this.messageParser !== undefined) {
        this.messageParser(topic, message);
      }
    });
  }

  /**
   * Publish message on topic
   *
   * @param topic Target topic
   * @param data JSON object stringify in process
   */
  public publish(topic: string, data: object): void {
    this.mqttClient.publish(topic, JSON.stringify(data));
  }

  /**
   * Subscribe to topic
   *
   * @param topic Source topic
   * @param messageParser Message parser
   */
  public subscribe(topic: string, messageParser: (topic: string, data: string) => void): void {
    this.mqttClient.subscribe(topic);
    this.messageParser = messageParser;
  }
}