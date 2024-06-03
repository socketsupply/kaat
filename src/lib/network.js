import { network as createNetwork, Encryption } from 'socket:network'

const network = async db => {
  let { data: dataPeer, err: errPeer } = await db.state.get('peer')

  if (errPeer) {
    dataPeer = {
      peerId: await Encryption.createId(),
      signingKeys: await Encryption.createKeyPair(),
      clusterId: await Encryption.createClusterId()
    }

    await db.state.put('peer', dataPeer)
  }

  const socket = await createNetwork(dataPeer)

  // TODO(@heapwolf): create subclusters for each channel in the db.
  const { data: channels } = await db.channels.readAll()

  const subclusters = {
    a: await socket.subcluster({ sharedKey: await Encryption.createSharedKey('A8F127DE-2A7C-4D4E-ABCC-6ADA0CFC140') }),
    b: await socket.subcluster({ sharedKey: await Encryption.createSharedKey('10B82A82-7522-42D9-8CBD-97DFBF0B5F5') })
  }

  return {
    socket,
    subclusters
  }
}

export { network }
