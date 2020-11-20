# phue2mqtt

Another daemon for communication between Philips Hue Gateway and a MQTT Broker.

## Install

```
npm install
```

## Start daemon

```
npm start config.json
```

The only argument is the configuration file, you can put it where you want. On sync, another file while be created in the same folder.

## Minimal configuration
A template configuration file is placed at the root of the project : __config.json__.
```jsonc
{
  "mqtt": {
    "server": "localhost", // Address of the MQTT server
    "login": "", // Username of user allowed to subscribe and publish
    "password": "", // Password of the user
    "port": 1883, // Port of the server (default: 1883)
    "useTls": false // Enable or disable TLS
  },
  "hue": {
    "discover": true, // Discover your gateway address
    "clientId": "phue2mqtt", // Id of the user registered
    "pollingInterval": 2 // Polling interval for update
  }
}
```
On sync, file __hue.json__ will be created in the same directory of the config file.

If you know IP address of your gateway, username and client key, you can add them in __config.json__.
```jsonc
{
  "mqtt": {
    "server": "localhost", // Address of the MQTT server
    "login": "", // Username of user allowed to subscribe and publish
    "password": "", // Password of the user
    "port": 1883, // Port of the server (default: 1883)
    "useTls": false // Enable or disable TLS
  },
  "hue": {
    "discover": false, // Disable discover
    "clientId": "phue2mqtt", // Id of the user registered
    "pollingInterval": 2, // Polling interval for update
    "gateway": "10.0.0.193", // Gateway IP
    "username: "woHopvWOskyu4-adartfe5OpO28QWzbasdUuy2fD", // Username
    "clientKey": "" // Client key
  }
}
```

## MQTT

### Device discovery and data

On daemon start, all detected devices data will be sended to the broker

* phue/lights/LIGHT_ID
* phue/groups/GROUP_ID
* phue/sensors/SENSOR_ID

```jsonc
{
  "id":3,
  "name":"Floor light",
  "state": {
    "on":false,
    "bri":150,
    "alert":"none",
    "mode":"homeautomation",
    "reachable":true
    },
    "model":"LWB010"
}
```

### Set state

Publish a message on the sub topic of the device /set. 

Example for turn on a light with the id 42 : 

Target topic : __phue/lights/42/set__
```jsonc
{
  "on": true
}
```

Another example, set brightness of a group : 

Target topic : __phue/groups/1/set__
```jsonc
{
  "bri": 30
}
```