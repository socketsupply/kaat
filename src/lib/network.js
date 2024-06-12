import { network as createNetwork, Encryption } from 'socket:network'

const network = async db => {
  let { data: dataPeer, err: errPeer } = await db.state.get('peer')

  let socket
  let subclusters = {}

  const createChannel = async (channel) => {
    const sharedKey = await Encryption.createSharedKey(channel.accessToken)
    const subcluster = await socket.subcluster({ sharedKey })
    const derivedKeys = await Encryption.createKeyPair(sharedKey)
    const subclusterId = Buffer.from(derivedKeys.publicKey).toString('base64')

    if (!dataPeer.subclusterId) dataPeer.subclusterId = subclusterId

    channel.subclusterId = subclusterId
    channel.sharedKey = sharedKey
    subclusters[channel.subclusterId] = subcluster

    await db.channels.put(channel.subclusterId, channel)
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
      nick: Math.random().toString(16).slice(2, 8)
    }

    socket = await createNetwork(dataPeer)

    //
    // Random channel data for first-timers to share with friends.
    //
    let channels = [
      {
        accessToken: crypto.randomUUID(),
        label: 'work'
      },
      {
        accessToken: crypto.randomUUID(),
        label: 'fun'
      }
    ]

    for (const channel of channels) {
      await createChannel(channel)
    }

    await db.state.put('peer', dataPeer)
  } else {
    socket = await createNetwork(dataPeer)
  }

  if (Object.keys(subclusters).length === 0) {
    const { data: dataChannels } = await db.channels.readAll()

    for (const channel of dataChannels.values()) {
      subclusters[channel.subclusterId] = await socket.subcluster({ sharedKey: channel.sharedKey })
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
  // Logging! Just tweak to filter logs, ie globalThis.DEBUG = '*'
  //
  socket.on('#debug', (pid, ...args) => {
    if (new RegExp(globalThis.DEBUG).test(output)) {
      console.log(pid.slice(0, 6), ...args)
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
