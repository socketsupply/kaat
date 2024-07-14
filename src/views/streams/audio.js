import { register } from '../../lib/component.js'
import Modal from '../../components/modal.js'

class Stream {
  constructor (opts) {
    this.sampleRate = 44100 / 4

    this.audioContext = new globalThis.AudioContext({ sampleRate: this.sampleRate })
    this.analyser = this.audioContext.createAnalyser()
    this.gainNode = this.audioContext.createGain()
    this.pcmNode = null
    this.onQueue = null
    this.onData = null
    this.onBuffer = null
    this.onAudioLevelChange = null
    this.mediaRecorder = null
    this.mediaStream = null
    this.sequenceNumber = 0
    this.seqRecv = 0
    this.receivedPackets = []

    // remote only
    this.queue = []
    this.isLocal = false
    this.sourceBuffer = null
    this.audioElement = null

    this.analyser.fftSize = 4096
    Object.assign(this, opts)

    this.stats = {
      created: 0,
      consumed: 0
    }
  }

  async start () {
    if (this.isLocal) {
      if (this.mediaStream) return // don't start twice.

      await this.audioContext.audioWorklet.addModule('views/streams/pcm.js')
      this.pcmNode = new AudioWorkletNode(this.audioContext, 'pcm-processor')

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.gainNode)
      source.connect(this.analyser)
      source.connect(this.pcmNode)

      // this.pcmNode.connect(this.audioContext.destination)
      // if you want to hear your local stream
      // this.gainNode.connect(this.audioContext.destination)

      this.pcmNode.port.onmessage = event => this.onData(event.data)

      this.startAnalyzingLocalNode()
    } else {
      this.startAnalyzingRemoteNode()
    }
  }

  stop () {
    if (!this.animationFrameId) return
    cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = null
  }

  async dequeue () {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    if (this.queue.length) {
      const chunk = this.queue.shift()

      const audioBuffer = this.audioContext.createBuffer(1, chunk.length, this.sampleRate)
      const channelData = audioBuffer.getChannelData(0)

      // Convert Int16Array to Float32Array for AudioBuffer
      for (let i = 0; i < chunk.length; i++) {
        channelData[i] = chunk[i] / 32768 // Normalize 16-bit PCM data
      }

      try {
        const bufferSource = this.audioContext.createBufferSource()
        bufferSource.buffer = audioBuffer
        bufferSource.onended = () => this.dequeue()
        bufferSource.connect(this.gainNode)
        bufferSource.connect(this.analyser)
        this.gainNode.connect(this.audioContext.destination)
        bufferSource.start()
      } catch (error) {
        console.error('Error during audio playback setup:', error)
      }
    }
  }

  async enqueue (raw) {
    const uint8Array = new Uint8Array(raw)
    const view = new DataView(uint8Array.buffer)

    const seq = view.getUint32(0, true)
    if (seq < this.seqRecv) return
    this.seqRecv = seq

    const data = new Int16Array(uint8Array.buffer.slice(4))

    this.queue.push(data)
    this.dequeue()
  }

  analyze () {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    this.analyser.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }

    // if (this.id) console.log(sum)
    const average = sum / bufferLength

    this.inputLevel = Math.min(1, average / 128) // Normalize input level to 0-1

    if (this.onAudioLevelChange) {
      this.onAudioLevelChange(this.inputLevel, sum)
    }
  }

  startAnalyzingRemoteNode () {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    const analyzeFrame = () => {
      this.analyze()
      this.animationFrameId = requestAnimationFrame(analyzeFrame)
    }

    this.animationFrameId = requestAnimationFrame(analyzeFrame)
  }

  startAnalyzingLocalNode () {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    const analyzeFrame = () => {
      const bufferLength = this.analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      if (!globalThis.navigator.onLine) return
      this.analyze()
      this.analyser.getByteTimeDomainData(dataArray)
      this.animationFrameId = requestAnimationFrame(analyzeFrame)
    }

    this.animationFrameId = requestAnimationFrame(analyzeFrame)
  }

  setVolume (value) {
    this.gainNode.gain.value = value
  }
}

async function AudioStream (props) {
  props.stream.onAudioLevelChange = (level) => {
    const borderWidth = 1 + level * 29
    this.firstElementChild.firstElementChild.style.outlineWidth = `${borderWidth}px`
  }

  props.stream.onBuffer = () => {
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

  // let onStream

  const cid = Buffer.from(net.socket.clusterId).toString('hex')
  const localStream = new Stream({ isLocal: true, id: net.socket.peerId })
  const remoteStreams = {}

  // @ts-ignore
  window.streams = {
    localStream,
    remoteStreams
  }

  const { data: dataPeer } = await db.state.get('peer')
  const pk = Buffer.from(dataPeer.signingKeys.publicKey).toString('base64')
  const { data: dataClaim } = await db.claims.get(pk)

  localStream.nick = dataClaim.nick

  const stopLocalStream = async () => {
    if (!localStream) return

    const { data: dataPeer } = await db.state.get('peer')
    const subcluster = net.subclusters[dataPeer.channelId]
    const partyName = [cid, dataPeer.channelId].join('')

    // subcluster.off(partyName, onStream)
    localStream.stop()
  }

  const createRemoteStream = async pk => {
    const elAudioGrid = this.querySelector('#audio-grid')

    const { data: dataClaim } = await db.claims.get(pk)
    const stream = new Stream({ id: pk, nick: dataClaim?.nick })
    remoteStreams[pk] = stream
    stream.setVolume(1)
    await stream.start()

    // recalibrate grid
    const items = Object.keys(remoteStreams).length
    const columns = Math.ceil(Math.sqrt(items))
    const rows = Math.ceil(items / columns)

    elAudioGrid.style.gridTemplateColumns = `repeat(${columns}, auto)`
    elAudioGrid.style.gridTemplateRows = `repeat(${rows}, auto)`

    // render the grid with all the streams
    elAudioGrid.render({ streams: [localStream, ...Object.values(remoteStreams)] })
    return stream
  }

  const startLocalStream = async () => {
    const { data: dataPeer } = await db.state.get('peer')

    const pk = Buffer.from(dataPeer.signingKeys.publicKey).toString('base64')
    const { data: dataClaim } = await db.claims.get(pk)

    localStream.nick = dataClaim.nick

    const subcluster = net.subclusters[dataPeer.channelId]

    const partyName = [cid, dataPeer.channelId].join('')

    localStream.onData = async (data) => {
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

    subcluster.on(partyName, async (value, packet) => {
      const pk = Buffer.from(packet.usr2).toString('base64')

      let stream = remoteStreams[pk]

      if (!stream) {
        stream = await createRemoteStream(pk)
      }

      stream.stats.consumed += value.byteLength

      stream.enqueue(Uint8Array.from(value))
    })

    localStream.setVolume(1)
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
    await AudioStreams.AudioGrid({ id: 'audio-grid', streams: [localStream, ...Object.values(remoteStreams)] })
  )
}

export default register(AudioStreams)
