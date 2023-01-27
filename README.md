# CloudGate
![js-standard-style](https://cdn.rawgit.com/standard/standard/master/badge.svg)

CloudGate is a Discord shard cluster microservice built on top of [CloudStorm](https://github.com/DasWolke/CloudStorm) with a REST api to perform gateway actions. CloudGate has a low resource footprint and publishes incoming messages through amqp like RabbitMQ. CloudGate has support for StatsD, DogStatsD, and Telegraf.

To get started with CloudGate, you want to `git clone` this repository first

Now run `npm install` or `yarn` in the cloned directory to install the necessary dependencies

## Configuration
Create a file named `config.json` in the config folder, you can use the `config.example.json` as an example of what the file should contain:
The botConfig is directly passed to the CloudStorm instance, so you can apply other options other than what's shown. Check CloudStorm for more info.
```json
{
  "token": "DISCORD BOT TOKEN",
  "host": "127.0.0.1",
  "port": 7000,
  "amqpUrl": "amqp://guest:guest@localhost:56782",
  "amqpQueue": "test-pre-cache",
  "authorization": "",
  "botConfig": {
    "firstShardId": 0,
    "lastShardId": 0,
    "shardAmount": 1,
    "initialPresence": {
      "status": "online",
      "activities": [
        {
          "name": "Some bot",
          "type": 0
        }
      ],
      "since": null,
      "afk": null
    }
  },
  "statsD": {
    "enabled": false,
    "host": "host",
    "port": 8125,
    "prefix": "CloudGate"
  }
}
```

## Run

To run the server, simple type `node index.js`

## Documentation

ANY /

Returns information about the gate including the Discord gateway version


application/json
```json
{
	"version": "0.2.0",
	"gatewayVersion": 10
}
```



POST /gateway/status-update

Updates either a shard's status or the entire cluster status


post json data:
```js
{
	shard_id?: number,
	since: number | null,
	activities: [
		{
			name: string,
			type: number,
			url?: string
		},
		...
	],
	status: "online" | "dnd" | "idle" | "invisible" | "offline",
	afk: boolean
}
```


application/json
```json
{
	"message": "Updated status"
}
```



POST /gateway/voice-status-update

Updates the voice state of a shard in the cluster


post json data
```js
{
	shard_id: number,
	guild_id: string,
	channel_id: string | null,
	self_mute?: boolean,
	self_deaf?: boolean
}
```


application/json
```json
{
	"message": "Updated status"
}
```



POST /gateway/request-guild-members

Requests guild members from a guild the cluster watches over through the gateway

This route does not return the requested members and instead sends it through a op 0 Dispatch GUILD_MEMBERS_CHUNK payload over the regular gateway amqp channel


post json data
```js
{
	shard_id: number,
	guild_id: string,
	query?: string,
	limit: number,
	presences?: boolean,
	user_ids?: Array<string>,
	nonce?: string
}
```


application/json
```json
{
	"message": "successfully sent payload"
}
```



GET /shards/status

Returns information about all of the shards in the cluster's status as well as the endpoint the shards are connected to


application/json
```json
{
	"shards": {
		"0": {
			"id": 0,
			"status": "ready",
			"ready": true,
			"trace": [an array of long debug strings],
			"seq": 1
		}
	},
	"endpoint": "wss://gateway.discord.gg?v=10&encoding=json&compress=zlib-stream"
}
```



GET /shards/queue
Returns information about which shards aren't ready and are pending connection
It is possible for this list to include shards which have been asked by Discord to resume or have already connected before but are no longer ready


application/json
```json
{
	"queue": [
		{
			id: 0
		}
	]
}
```



GET /shards/:id
Returns information about a specific shard in the cluster


application/json
```json
{
	"id": 0,
	"status": "ready",
	"ready": true,
	"trace": [an array of long debug strings],
	"seq": 1
}
```
