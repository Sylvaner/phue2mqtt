# phue2mqtt

## Install

```
npm install
```

## Start daemon

```
npm start config.json
```

The only argument is the configuration file, you can put it where you want

## Minimal configuration
An empty configuration file is placed at the root of the project : __config.json__.
```
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
On sync, file __hue.json__ will be created.

If you know IP address of your gateway, username and client key, you can add them in __config.json__.
```
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
