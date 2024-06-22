import Indexed from '@socketsupply/indexed'
import { network as createNetwork, Encryption } from 'socket:network'

const network = async db => {
  let { data: dataPeer, err: errPeer } = await db.state.get('peer')

  let socket
  let subclusters = {}

  const createChannel = async (channel) => {
    // Create a shared key from from the access token
    const sharedKey = await Encryption.createSharedKey(channel.accessToken)

    // Initialize a subcluster from that sharedKey
    const subcluster = await socket.subcluster({ sharedKey })

    // Create a channel id from the hex of the subclusterId, used by the UI
    channel.channelId = Buffer.from(subcluster.subclusterId).toString('hex')

    // Used for encryption/decryption
    channel.subclusterId = Buffer.from(subcluster.subclusterId).toString('base64')

    // Create defaults on the peer if it doesnt already have them
    if (!dataPeer.channelId) {
      dataPeer.channelId = channel.channelId
      dataPeer.subclusterId = channel.subclusterId
    }

    // Make the subcluster avaialable by the channel id
    subclusters[channel.channelId] = subcluster

    // Create a table for the channel messages
    db[channel.channelId] = await Indexed.open(channel.channelId)

    await db.channels.put(channel.channelId, channel)
  }

  //
  // If there's not data in the peer, we can assume that we dont have any data at all.
  // At this point, we need to create some data and save it to the database.
  //
  if (errPeer) {
    dataPeer = {
      peerId: await Encryption.createId(),
      signingKeys: await Encryption.createKeyPair(),
      clusterId: await Encryption.createClusterId('kaat'),
    }

    const pk = dataPeer.signingKeys.publicKey
    const b64pk = Buffer.from(pk).toString('base64')

    await db.claims.put(b64pk, {
      ctime: Date.now(),
      nick: Math.random().toString(16).slice(2, 8),
      status: 'Hello, World!',
      peerId: dataPeer.peerId,
      clock: 0,
      origin: true,
      publicKey: b64pk
    })

    socket = await createNetwork(dataPeer)

    const modelDefaults = {
      path: `model.gguf`,
      prompt: `<s>[INST]You're a coding assistant focused on Web Development. You try to provide concise answers about html, css, and javascript questions.[/INST]</s>`,
      chatml: false,
      conversation: true,
      // repeat_penalty: '1.1',
      // temp: '0.6',
      // instruct: true,
      n_ctx: 1024
    }

    //
    // Random channel data for first-timers to share with friends.
    //
    let channels = [
      {
        accessToken: crypto.randomUUID(),
        label: 'work',
        ...modelDefaults
      },
      {
        accessToken: crypto.randomUUID(),
        label: 'fun',
        ...modelDefaults
      }
    ]

    for (const channel of channels) {
      await createChannel(channel)
    }

    await db.state.put('peer', dataPeer)
  } else {
    socket = await createNetwork(dataPeer)
  }

    const pk = dataPeer.signingKeys.publicKey
    const b64pk = Buffer.from(pk).toString('base64')

    await db.claims.put(b64pk, {
      ctime: Date.now(),
      nick: Math.random().toString(16).slice(2, 8),
      status: 'Hello, World!',
      peerId: dataPeer.peerId,
      clock: 0,
      origin: true,
      publicKey: b64pk
    })

  window.socket = socket

  globalThis.addEventListener('online', () => {
    if (socket) socket.reconnect()
  })

  globalThis.addEventListener('offline', () => {
    console.log('OFFLINE')
  })

  if (Object.keys(subclusters).length === 0) {
    const { data: dataChannels } = await db.channels.readAll()

    for (const channel of dataChannels.values()) {
      const sharedKey = await Encryption.createSharedKey(channel.accessToken)
      subclusters[channel.channelId] = await socket.subcluster({ sharedKey })
    }
  }

  //
  // The socket will advise us when it's a good time to save the state of the peer.
  // This might happen more frequently than we want to write to the database so we
  // should debounce it.
  //
  let debouncer = null
  socket.on('#state', async info => {
    clearTimeout(debouncer)

    debouncer = setTimeout(async () => {
      const { err: errGet, data } = await db.state.get('peer')

      if (errGet) {
        console.error(errGet)
        return
      }

      const { err: errPut } = await db.state.put('peer', { ...data, ...info })

      if (errPut) {
        console.error(errPut)
      }
    }, 512)
  })

  //
  // Debugging! Just tweak to filter logs, this is a firehose!
  // Don't listen to debug in production, it can strain the CPU.
  //
  socket.on('#debug', (pid, str, ...args) => {
    if (str.includes('DROP')) {
      console.log(str, ...args)
    }

    if (str.includes('JOIN')) {
      console.log(str, ...args)
    }

    if (str.includes('INTRO')) {
      console.log(str, ...args)
    }
  })

  socket.on('#connection', (packet, peer) => {
    // sync is bidirectional, so it only needs to be
    // initiated by one side. in this case we simply
    // select the lexicographically higher peerId to
    // kick-off the syncing protocol.
    if (peer.lastSync > Date.now() - 6000) {
      socket.sync(peer.peerId)
      peer.lastSync = Date.now()
    }
  })

  // socket.on('#packet', (...args) => console.log('PACKET', ...args))
  // socket.on('#send', (...args) => console.log('SEND', ...args))

  return {
    socket,
    subclusters,
    createChannel
  }
}

export { network }
