import { Register } from '../../lib/component.js'
import { Modal } from '../../components/modal.js'
import process from 'socket:process'

class Stream {
  constructor (opts) {
    Object.assign(this, opts)

    const AudioContext = window.AudioContext || window.webkitAudioContext

    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.onQueue = null
    this.onData = null
    this.onAudioLevelChange = null
    this.mediaRecorder = null
    this.mediaStream = null

    // remote only
    this.queue = []
    this.isProcessingQueue = false
    this.sourceBuffer = null
    this.audioElement = null
  }

  async start (ms = 1) {
    if (this.isLocal) {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        audioBitsPerSecond: 64000 / 2, // 64k bps or 32kbps
        mimeType: 'audio/mp4'
      })

      this.mediaRecorder.ondataavailable = (event) => {
        this.analyze()
        if (this.onData) this.onData(event.data)
      }

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.analyser)
      this.analyser.fftSize = 256

      this.mediaRecorder.start(ms)
    } else {
      this.audioElement = document.createElement('audio')
      this.audioElement.playsInline = true
      this.audioElement.disableRemotePlayback = true

      let MediaSource = globalThis.MediaSource

      if (process.platform === 'ios') {
        MediaSource = globalThis.ManagedMediaSource
      }

      this.mediaSource = new MediaSource()
      this.mediaStream = new MediaStream()

      this.mediaStream.controls = false

      await new Promise(resolve => {
        this.audioElement.src = URL.createObjectURL(this.mediaSource)
        this.mediaSource.addEventListener('sourceopen', () => {
          this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mp4')
          this.sourceBuffer.addEventListener('updateend', () => this.dequeue(), { once: true })
          resolve()
        }, { once: true })
      })

      const source = this.audioContext.createMediaElementSource(this.audioElement)
      source.connect(this.analyser)
      source.connect(this.audioContext.destination) // output to the speakers
      this.analyser.fftSize = 64

      this.audioElement.addEventListener('play', () => {
        this.startAnalyzing()
      })

      this.audioElement.addEventListener('pause', () => {
        this.stopAnalyzing()
      })

      this.audioElement.addEventListener('canplay', () => {
        this.audioElement.play().catch(err => {})
      })

      this.audioElement.addEventListener('timeupdate', () => {
        // console.log(`Remote Stream Current time: ${this.audioElement.currentTime}`);
      })

      // this.audioElement.play().catch(error => {
      //   console.error('Error playing audio:', error);
      // })
    }
  }

  stop () {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
    }

    if (this.isLocal && this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder.ondataavailable = null
      this.mediaRecorder.onstop = null
    }
  }

  dequeue () {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    if (this.queue.length && this.sourceBuffer && !this.sourceBuffer.updating) {
      const chunk = this.queue.shift()
      this.sourceBuffer.appendBuffer(chunk)
      this.analyze()
    }

    if (this.queue.length && this.sourceBuffer) {
      this.sourceBuffer.addEventListener('updateend', () => this.dequeue(), { once: true })
      return
    }

    this.isProcessingQueue = false
  }

  async enqueue (ab) {
    if (this.onQueue) this.onQueue()

    if (this.sourceBuffer && !this.sourceBuffer.updating) {
      this.sourceBuffer.appendBuffer(ab)
      // console.log(`Appending buffer=${ab.byteLength}, buf=${this.audioElement.buffered.length}, state=${this.audioElement.readyState}, level=${this.inputLevel}, id=${this.id})`)

      await new Promise(resolve => {
        this.sourceBuffer.addEventListener('updateend', resolve, { once: true })
      })

      this.audioElement.play()
      this.analyze()
    } else {
      this.queue.push(ab)
    }

    if (!this.isProcessingQueue) {
      this.isProcessingQueue = true
      this.dequeue()
    }
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
      this.onAudioLevelChange(this.inputLevel)
    }
  }

  startAnalyzing () {
    const analyzeFrame = () => {
      this.analyze()
      this.animationFrameId = requestAnimationFrame(analyzeFrame)
    }

    this.animationFrameId = requestAnimationFrame(analyzeFrame)
  }

  stopAnalyzing () {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
}

async function AudioStream (props) {
  const timeout = null

  props.stream.onAudioLevelChange = level => {
    const borderWidth = 1 + level * 29
    this.firstElementChild.firstElementChild.style.outlineWidth = `${borderWidth}px`
  }

  return [
    await Avatar({ ...props.stream, classNames: ['large'] }),
    div({ class: 'author' },
      div({ class: 'nick' }, '@', props.stream.nick)
    )
  ]
}

AudioStream = Register(AudioStream)

async function AudioGrid (props) {
  return props.streams.map(stream => {
    return AudioStream({ id: stream.id, stream })
  })
}

AudioGrid = Register(AudioGrid)

//
// This is not re-rendered.
//
async function ModalAudioStreams (props) {
  const {
    net,
    db
  } = props

  // let onStream

  const cid = Buffer.from(net.socket.clusterId).toString('hex')
  const localStream = new Stream({ isLocal: true, id: net.socket.peerId })
  const remoteStreams = {}

  window.remoteStreams = remoteStreams

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

    localStream.onData = async data => {
      if (data.size <= 0) return

      const buf = await data.arrayBuffer()
      await subcluster.stream(partyName, buf)
    }

    subcluster.on(partyName, async (value, packet) => {
      const pk = Buffer.from(packet.usr2).toString('base64')

      let stream = remoteStreams[pk]

      if (!stream) {
        stream = await createRemoteStream(pk)
      }

      const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      stream.enqueue(buf)
    })

    await localStream.start()
  }

  const onclick = (event, match) => {
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
    await AudioGrid({ id: 'audio-grid', streams: [localStream, ...Object.values(remoteStreams)] })
  )
}

ModalAudioStreams = Register(ModalAudioStreams)

export { ModalAudioStreams }
