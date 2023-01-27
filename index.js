const http = require('http')

const amqp = require('amqplib')
const CloudStorm = require('cloudstorm').Client

const passthrough = require('./passthrough')
const config = require('./config/config.json')
const bot = new CloudStorm(config.token, config.botConfig)
/** @type {typeof import("hot-shots") | undefined} */
let StatsD
/** @type {import("hot-shots").StatsD | undefined} */
let statsClient
try {
  StatsD = require('hot-shots')
} catch (e) {
  StatsD = undefined
}
if (StatsD && config.statsD?.enabled) statsClient = new StatsD.StatsD(config.statsD)

Object.assign(passthrough, { bot })

const paths = require('./routes')

const server = http.createServer(async (req, res) => {
  try {
    if (config.authorization?.length && req.headers.authorization !== config.authorization) return res.writeHead(401).end()
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const path = paths[url.pathname]
    if (path) {
      if (req.method?.toUpperCase() === 'OPTIONS') res.writeHead(204, { Allow: path.methods.join(', ') })
      else if (!path.methods.includes(req.method?.toUpperCase() || '')) res.writeHead(405).end()
      else if (req.headers.range) res.writeHead(416).end()
      else if (req.headers.expect) res.writeHead(417).end()
      else await path.handle(req, res, url)
    }
  } catch (e) {
    console.error(e)
    if (res.writable) res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'internal server error', error: String(e) }))
  }

  if (!req.destroyed) req.destroy()
  if (!res.destroyed) res.destroy()
})

server.once('listening', () => console.log(`Server listening on ${config.host}:${config.port}`))
server.listen(config.port, config.host)

bot.once('ready', () => console.log(`Bot is ready with ${Object.keys(bot.shardManager.shards).length} shards`))

;(async () => {
  const connection = await amqp.connect(config.amqpUrl)
  connection.on('error', console.error)
  const channel = await connection.createChannel()
  await channel.assertQueue(config.amqpQueue, { durable: false, autoDelete: true })
  console.log('AMQP Connection ready')
  await bot.connect()

  bot.on('event', event => {
    if (statsClient) {
      statsClient.increment('discordevent', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], err => {
        if (err) console.log(err)
      })

      if (event.t !== 'PRESENCE_UPDATE') {
        statsClient.increment('discordevent.np', 1, 1, [`shard:${event.shard_id}`, `event:${event.t}`], err => {
          if (err) console.log(err)
        })
      }
    }
    channel.sendToQueue(config.amqpQueue, Buffer.from(JSON.stringify(event)), { contentType: 'application/json' })
    // Event was sent to amqp queue, now you can use it somewhere else
  })
})()
