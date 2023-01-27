const version = require('./package.json').version

const { bot } = require('./passthrough')

const meta = `{"version":"${version}","gatewayVersion":${require('cloudstorm').Constants.GATEWAY_VERSION}}`
const updatedStatusMessage = '{"message":"Updated status"}'
const payloadSentMessage = '{"message":"successfully sent payload"}'
const missingStatus = '{"message":"missing status"}'
const missingShardIDMessage = '{"message":"missing shard_id"}'
const missingGuildIDMessage = '{"message":"missing guild_id"}'

const jsonHeaders = { 'Content-Type': 'application/json' }

/**
 * @type {{ [path: string]: { methods: Array<string>; handle(req: import("http").IncomingMessage, res: import("http").ServerResponse, url: URL): Promise<unknown> } }}
 */
const paths = {
  '/': {
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'PUT'],
    async handle (req, res, url) {
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(meta)
    }
  },
  '/gateway/status-update': {
    methods: ['POST'],
    async handle (req, res) {
      if (!req.headers['content-length']) return res.writeHead(411).end()
      const body = await requestBody(req)
      /** @type {import("discord-typings").GatewayPresenceUpdate & { shard_id?: number }} */
      const status = JSON.parse(body.toString('utf-8'))

      if (!status.status) return res.writeHead(400, jsonHeaders).end(missingStatus)
      if (typeof status.shard_id === 'number') {
        const shard = Object.values(bot.shardManager.shards).find(s => s.id === Number(status.shard_id))
        if (!shard) return res.writeHead(404, jsonHeaders).end(JSON.stringify({ message: `Shard ${status.shard_id} does not exist` }))
        await bot.shardStatusUpdate(status.shard_id, status)
      } else await bot.shardManager.presenceUpdate(status)
      res.writeHead(200, jsonHeaders).end(updatedStatusMessage)
    }
  },
  '/gateway/voice-status-update': {
    methods: ['POST'],
    async handle (req, res) {
      if (!req.headers['content-length']) return res.writeHead(411).end()
      const body = await requestBody(req)
      /** @type {import("discord-typings").VoiceStateUpdatePayload & { shard_id?: number }} */
      const state = JSON.parse(body.toString('utf-8'))

      if (typeof state.shard_id !== 'number') return res.writeHead(400, jsonHeaders).end(missingShardIDMessage)
      if (!state.guild_id) return res.writeHead(400, jsonHeaders).end(missingGuildIDMessage)
      const shard = Object.values(bot.shardManager.shards).find(s => s.id === Number(state.shard_id))
      if (!shard) return res.writeHead(404, jsonHeaders).end(JSON.stringify({ message: `Shard ${state.shard_id} does not exist` }))

      await bot.voiceStateUpdate(state.shard_id, state)
      res.writeHead(200, jsonHeaders).end(payloadSentMessage)
    }
  },
  '/gateway/request-guild-members': {
    methods: ['POST'],
    async handle (req, res) {
      if (!req.headers['content-length']) return res.writeHead(411).end()
      const body = await requestBody(req)
      /** @type {import("discord-typings").GuildRequestMembersPayload & { shard_id?: number }} */
      const payload = JSON.parse(body.toString('utf-8'))

      if (typeof payload.shard_id !== 'number') return res.writeHead(400, jsonHeaders).end(missingShardIDMessage)
      if (!payload.guild_id) return res.writeHead(400, jsonHeaders).end(missingGuildIDMessage)
      const shard = Object.values(bot.shardManager.shards).find(s => s.id === Number(payload.shard_id))
      if (!shard) return res.writeHead(404, jsonHeaders).end(JSON.stringify({ message: `Shard ${payload.shard_id} does not exist` }))

      await bot.requestGuildMembers(payload.shard_id, payload)
      res.writeHead(200, jsonHeaders).end(payloadSentMessage)
    }
  },
  '/shards/status': {
    methods: ['GET', 'HEAD'],
    async handle (req, res) {
      const slist = bot.shardManager.shards
      const shards = Object.keys(slist)
      const payload = {}
      for (let i = 0; i < shards.length; i++) {
        /** @type {import("cloudstorm").Shard} */
        const shard = slist[shards[i]]
        payload[i] = {
          id: shard.id,
          status: shard.connector.status,
          ready: shard.ready,
          trace: shard.connector._trace,
          seq: shard.connector.seq
        }
      }
      return res.writeHead(200, jsonHeaders).end(JSON.stringify({ shards: payload, endpoint: bot.options.endpoint }))
    }
  },
  '/shards/queue': {
    methods: ['GET', 'HEAD'],
    async handle (req, res) {
      const notReady = Object.values(bot.shardManager.shards).filter(s => !s.ready).map(s => ({ id: s.id }))
      return res.writeHead(200, jsonHeaders).end(JSON.stringify({ queue: notReady }))
    }
  }
}

/**
 * @type {{ [route: string]: { methods: Array<string>; router(req: import("http").IncomingMessage, res: import("http").ServerResponse, url: URL, params: { [param: string]: string }): Promise<unknown> } }}
 */
const routes = {
  '/shards/:id': {
    methods: ['GET'],
    async router (req, res, url, params) {
      const shard = Object.values(bot.shardManager.shards).find(s => s.id === Number(params.id))
      if (!shard) return res.writeHead(404, jsonHeaders).end(JSON.stringify({ message: `Shard ${params.id} does not exist` }))
      const shardData = {
        id: shard.id,
        status: shard.connector.status,
        ready: shard.ready,
        trace: shard.connector._trace,
        seq: shard.connector.seq
      }
      return res.writeHead(200, jsonHeaders).end(JSON.stringify(shardData))
    }
  }
}

/** @typedef {{ route?: string; }} Folder */

/** @type {Folder} */
const folders = {}

/**
 * @param {Array<string>} steps
 * @returns {{ route: string } | null}
 */
function getRouteFromFolders (steps) {
  let current = folders
  for (let i = 0; i < steps.length; i++) {
    if (!current) return null
    else if (current[steps[i]]) current = current[steps[i]]
    else {
      const traversible = Object.keys(current).find(item => item[0] === ':' && (!!current[item].route || current[item][steps[i + 1]])) // routes cannot have a dynamic key directly after one.
      if (traversible) current = current[traversible]
      else return null
    }
  }
  if (!current.route) return null
  return { route: current.route }
}

const slash = /\//g

for (const key of Object.keys(routes)) {
  const split = key.split(slash).slice(1)
  let previous = folders
  for (let i = 0; i < split.length; i++) {
    const path = split[i]
    if (!previous[path]) previous[path] = {}
    if (i === split.length - 1) {
      previous[path].route = key
    }
    previous = previous[path]
  }
}

const prox = new Proxy(paths, {
  get (target, property, receiver) {
    const existing = Reflect.get(target, property, receiver)
    if (existing) return existing
    const prop = property.toString()
    const split = prop.split(slash).slice(1)
    const pt = getRouteFromFolders(split)
    if (!pt || !pt.route) return undefined

    /** @type {{ [param: string]: string }} */
    const params = {}
    const routeFolders = pt.route.split(slash).slice(1)
    for (let i = 0; i < split.length; i++) {
      if (routeFolders[i][0] === ':') params[routeFolders[i].slice(1)] = split[i]
    }

    return {
      methods: routes[pt.route].methods,
      handle: (req, res, url) => routes[pt.route].router(req, res, url, params)
    }
  }
})

/**
 * @param {import("http").IncomingMessage} req
 * @param {number} [timeout]
 * @returns {Promise<Buffer>}
 */
function requestBody (req, timeout = 10000) {
  if (!req.headers['content-length']) throw new Error('CONTENT_LENGTH_REQURED')
  const sizeToMeet = Number(req.headers['content-length'])
  return new Promise((resolve, reject) => {
    /** @type {NodeJS.Timeout | null} */
    let timer = null
    let totalSize = 0
    /** @type {Array<Buffer>} */
    const chunks = []
    /** @param {Buffer} chunk */
    function onData (chunk) {
      totalSize += chunk.byteLength
      if (totalSize > sizeToMeet) {
        req.removeListener('data', onData)
        req.removeListener('end', onEnd)
        return reject(new Error('BYTE_SIZE_DOES_NOT_MATCH_LENGTH'))
      }
      chunks.push(chunk)
    }
    function onEnd () {
      if (timer) clearTimeout(timer)
      req.removeListener('data', onData)
      resolve(Buffer.concat(chunks))
    }
    req.on('data', onData)
    req.once('end', onEnd)
    timer = setTimeout(() => {
      req.removeListener('data', onData)
      req.removeListener('end', onEnd)
      reject(new Error('TIMEOUT_WAITING_FOR_BODY_REACHED'))
    }, timeout)
  })
}

module.exports = prox
