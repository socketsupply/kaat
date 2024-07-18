import { register } from '../../lib/component.js'
import { Stream } from '../../lib/stream.js'
import Modal from '../../components/modal.js'

async function AudioStream (props) {
  props.stream.onAudioLevelChange = level => {
    const borderWidth = 1 + level * 29

    this
      .firstElementChild
      .firstElementChild
      .style
      .outlineWidth = `${borderWidth}px`
  }

  return [
    await Avatar({ ...props.stream, classNames: ['large'] }),
    div({ class: 'author' },
      div({ class: 'nick' }, '@', props.stream.nick),
      div({ class: 'bytes' })
    )
  ]
}

AudioStreams.AudioStream = register(AudioStream)

async function AudioGrid (props) {
  return props.streams.map(stream => {
    return AudioStreams.AudioStream({ id: stream.id, stream })
  })
}

AudioStreams.AudioGrid = register(AudioGrid)

//
// This is not re-rendered.
//
async function AudioStreams (props) {
  const {
    net,
    db
  } = props

  const cid = Buffer.from(net.socket.clusterId).toString('hex')
  const localStream = new Stream({ isLocal: true, id: net.socket.peerId })
  const remoteStreams = {}

  let onStream = null // The current Stream

  // @ts-ignore // for debugging/inspecting
  window.streams = {
    localStream,
    remoteStreams
  }

  const { data: dataPeer } = await db.state.get('peer')
  const pk = Buffer.from(dataPeer.signingKeys.publicKey).toString('base64')
  const { data: dataClaim } = await db.claims.get(pk)

  localStream.nick = dataClaim.nick

  const stopLocalStream = async () => {
    if (!onStream) return

    const { data: dataPeer } = await db.state.get('peer')
    const subcluster = net.subclusters[dataPeer.channelId]
    const partyName = [cid, dataPeer.channelId].join('')

    subcluster.off(partyName, onStream)
    localStream.stop()
  }

  const recalibrateGrid = (props) => {
    const elAudioGrid = this.querySelector('#audio-grid')
    const items = Object.keys(remoteStreams).length
    const columns = Math.ceil(Math.sqrt(items))
    const rows = Math.ceil(items / columns)

    elAudioGrid.style.gridTemplateColumns = `repeat(${columns}, auto)`
    elAudioGrid.style.gridTemplateRows = `repeat(${rows}, auto)`
    elAudioGrid.render(props)
  }

  const createRemoteStream = async pk => {
    const { data: dataClaim } = await db.claims.get(pk)
    const stream = new Stream({ id: pk, nick: dataClaim?.nick, localStream })

    stream.onEnd = () => {
      stream.stop({ destroy: true })
      delete remoteStreams[pk]
      recalibrateGrid({ streams: [localStream, ...Object.values(remoteStreams)] })
    }

    await stream.start()

    remoteStreams[pk] = stream

    recalibrateGrid({ streams: [localStream, ...Object.values(remoteStreams)] })
    return stream
  }

  const startLocalStream = async () => {
    const { data: dataPeer } = await db.state.get('peer')

    const pk = Buffer.from(dataPeer.signingKeys.publicKey).toString('base64')
    const { data: dataClaim } = await db.claims.get(pk)

    if (localStream.channelId !== dataPeer.channelId) {
      await stopLocalStream()
    }

    localStream.channelId = dataPeer.channelId
    localStream.nick = dataClaim.nick

    const subcluster = net.subclusters[dataPeer.channelId]

    const partyName = [cid, dataPeer.channelId].join('')

    // When the local stream has data, send it to any known and relevant peers
    localStream.onData = async data => {
      const sequenceNumber = localStream.sequenceNumber++
      const int16Array = new Int16Array(data) // Ensure data is Int16Array

      // Create a packet with 4 extra bytes for the sequence number
      const packet = new Uint8Array(int16Array.length * 2 + 4) // Each Int16 takes 2 bytes
      const view = new DataView(packet.buffer)

      // Set the sequence number in the first 4 bytes
      view.setUint32(0, sequenceNumber, true)

      // Copy the Int16Array data into the packet after the sequence number
      packet.set(new Uint8Array(int16Array.buffer), 4)

      localStream.stats.created += int16Array.byteLength

      // Send the packet over the network
      await subcluster.stream(partyName, packet)
    }

    // When there is new data from the network, enqueue it for stream processing
    onStream = async (value, packet) => {
      const pk = Buffer.from(packet.usr2).toString('base64')

      let stream = remoteStreams[pk]

      if (!stream) {
        stream = await createRemoteStream(pk)
      }

      stream.stats.consumed += value.byteLength

      stream.enqueue(Uint8Array.from(value))
    }

    subcluster.on(partyName, onStream)

    net.socket.reconnect()

    await localStream.start()
  }

  const onclick = (_, match) => {
    const el = match('[data-event]')

    if (el?.dataset.event === 'stop-stream') {
      stopLocalStream()
    }

    if (el?.dataset.event === 'start-stream') {
      startLocalStream()
    }
  }

  return Modal(
    {
      id: 'audio-streams',
      header: 'Audio Streams',
      buttons: [
        { label: 'Stop', event: 'stop-stream' },
        { label: 'Start', event: 'start-stream', class: 'confirm' }
      ],
      onclick
    },
    await AudioStreams.AudioGrid({
      id: 'audio-grid',
      streams: [localStream, ...Object.values(remoteStreams)]
    })
  )
}

export default register(AudioStreams)
