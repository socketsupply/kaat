import { network as createNetwork, Encryption } from 'socket:network'

const network = async db => {
  let { data: dataPeer, err: errPeer } = await db.state.get('peer')

  let socket
  let subclusters = {}

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
        key: crypto.randomUUID(),
        label: 'work'
      },
      {
        key: crypto.randomUUID(),
        label: 'fun'
      }
    ]

    for (const channel of channels) {
      const sharedKey = await Encryption.createSharedKey(channel.key)
      const subcluster = await socket.subcluster({ sharedKey })
      const derivedKeys = await Encryption.createKeyPair(sharedKey)
      const subclusterId = Buffer.from(derivedKeys.publicKey).toString('base64')

      if (!dataPeer.subclusterId) dataPeer.subclusterId = subclusterId

      channel.subclusterId = subclusterId 
      channel.sharedKey = sharedKey
      subclusters[channel.subclusterId] = subcluster

      await db.channels.put(channel.subclusterId, channel)
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
  socket.on('#state', async info => {
    // console.log('???', info)
  })

  // socket.on('#debug', (...args) => console.log('DEBUG', ...args))
  // socket.on('#packet', (...args) => console.log('PACKET', ...args))
  // socket.on('#send', (...args) => console.log('SEND', ...args))

  return {
    socket,
    subclusters
  }
}

export { network }
