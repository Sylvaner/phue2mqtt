import { ConfigManager } from './services/ConfigManager';
import { MqttConnector } from './services/MqttConnector';
import { HueLink } from './services/HueLink';

const configManager = new ConfigManager();

/**
 * Start Hue service
 *
 * @remarks Sync and discover process on first launch
 *
 * @param hueLink Hue service
 * @param mqttConnector MQTT Service
 */
function startHue(hueLink: HueLink, mqttConnector: MqttConnector): void {
  if (hueLink.isSynced()) {
    if (hueLink.gatewayFound()) {
      hueLink.connect(() => { hueStarted(hueLink, mqttConnector); });
    } else {
      console.error('HUE: Problem in configuration')
    }
  } else {
    if (hueLink.gatewayFound()) {
      hueLink.tryToSync((result) => {
        if (Object.keys(result).length) {
          configManager.saveHueData(result);
        }
        // Loop every 5 seconds, waiting press on sync button
        setTimeout(() => { startHue(hueLink, mqttConnector); }, 5000);
      });
    } else {
      // First time, discover gateway
      hueLink.discover(() => {
        setTimeout(() => { startHue(hueLink, mqttConnector); }, 5000);
      });
    }
  }
}

/**
 * Function called when Hue is synced and connected
 *
 * Publish all devices at start and start Hue events loop.
 *
 * @remarks Is MQTT is not connected, wait 5 seconds before retry
 *
 * @param hueLink Hue service
 */
function hueStarted(hueLink: HueLink, mqttConnector: MqttConnector): void {
  const waitMqttInterval = setInterval(() => {
    // Waiting MQTT connection
    if (mqttConnector.isConnected()) {
      clearInterval(waitMqttInterval);
      hueLink.publishAllDevices(() => {
        mqttConnector.subscribe(hueLink.getTopicToSubscribe(), (topic, data) => {
          hueLink.parseMessage(topic, data);
        });
        hueLink.start();
      });
    }
  }, 5000)
}

/**
 * Entry point
 */
if (process.argv.length < 3) {
  console.log(`Usage: ${process.argv[1]} config_file.json`);
}
else {
  if (configManager.readGlobalConfig(process.argv[2])) {
    const mqttConnector = new MqttConnector(configManager.getMqttConfig());
    const hueLink = new HueLink(configManager.getHueConfig(), mqttConnector, configManager.getDebugMode());
    mqttConnector.connect();
    startHue(hueLink, mqttConnector);
  }
}
