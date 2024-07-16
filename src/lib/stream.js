export class Stream {
  constructor (opts) {
    this.sampleRate = 16000 // Set sample rate to 16 kHz

    this.audioContext = new globalThis.AudioContext({ sampleRate: this.sampleRate, latencyHint: 'interactive' })
    this.analyser = this.audioContext.createAnalyser()
    this.gainNode = this.audioContext.createGain()
    this.pcmNode = null
    this.onQueue = null
    this.onData = null
    this.onEnd = null
    this.onDevice = null
    this.onAudioLevelChange = null
    this.mediaRecorder = null
    this.mediaStream = null
    this.sequenceNumber = 0
    this.seqRecv = 0
    this.channelId = null
    this.localStream = null
    this.nick = ''
    this.receivedPackets = []

    this.highWaterMark = 32 // Number of chunks to buffer before playing
    this.gainNode.gain.value = 0.1

    // remote only
    this.queue = []
    this.maxQueueSize = 512
    this.isLocal = false
    this.isStopped = false
    this.sourceBuffer = null
    this.audioElement = null

    // this.analyser.fftSize = 4096;
    Object.assign(this, opts)

    this.stats = {
      created: 0,
      consumed: 0
    }

    this.lastEnqueueTime = Date.now()
  }

  async getActiveDevice () {
    if (!this.inputTrack) return null

    const settings = this.inputTrack.getSettings()
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.find(device => device.deviceId === settings.deviceId)
  }

  async start () {
    if (this.isLocal) {
      this.isStopped = false

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      if (!this.mediaStream) {
        await this.audioContext.audioWorklet.addModule('views/streams/pcm.js')
        this.pcmNode = new globalThis.AudioWorkletNode(this.audioContext, 'pcm-processor')
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      source.connect(this.gainNode)
      source.connect(this.analyser)
      source.connect(this.pcmNode)

      this.inputTrack = this.mediaStream.getAudioTracks()[0];

      // TODO: allow monitor for headphones
      // this.pcmNode.connect(this.audioContext.destination)
      // this.gainNode.connect(this.audioContext.destination)
      this.pcmNode.port.onmessage = event => this.onData(event.data)
    } else {
      this.timeout = setInterval(async () => {
        const now = Date.now()

        if (now - this.lastEnqueueTime > 60000) {
          this.stop()
          if (this.onEnd) this.onEnd()
        }
      }, 1000) // Check every second
    }

    this.startAnalyzingNode()
  }

  async dequeue () {
    if (this.queue.length) {
      const bufferChunks = this.queue.splice(0, this.highWaterMark)
      const bufferLength = bufferChunks.reduce((sum, chunk) => sum + chunk.length, 0)

      const audioBuffer = this.audioContext.createBuffer(1, bufferLength, this.sampleRate)
      const channelData = audioBuffer.getChannelData(0)

      let offset = 0
      bufferChunks.forEach(chunk => {
        for (let i = 0; i < chunk.length; i++) {
          channelData[offset + i] = chunk[i] / 32768 // Normalize 16-bit PCM data
        }
        offset += chunk.length
      })

      try {
        const bufferSource = this.audioContext.createBufferSource()
        bufferSource.buffer = audioBuffer
        bufferSource.onended = () => {
          this.localStream.setVolume(0.6)
          bufferSource.disconnect()
          this.dequeue()
        }
        bufferSource.connect(this.gainNode)
        bufferSource.connect(this.analyser)
        this.gainNode.connect(this.audioContext.destination)
        this.localStream.setVolume(0)
        bufferSource.start(0)
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

    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Queue is full, removing oldest packet to make space')
      this.queue.shift() // Remove the oldest packet
    }

    this.queue.push(data)
    this.lastEnqueueTime = Date.now()
    if (this.queue.length >= this.highWaterMark) { // Start playback only if there are enough chunks
      this.dequeue()
    }
  }

  analyze () {
    if (!this.analyser) return
    if (this.isStopped) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    this.analyser.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }

    const average = sum / bufferLength

    this.inputLevel = Math.min(1, average / 128) // Normalize input level to 0-1

    if (this.onAudioLevelChange) {
      this.onAudioLevelChange(this.inputLevel, sum)
    }
  }

  startAnalyzingNode () {
    if (this.animationFrameId) {
      globalThis.cancelAnimationFrame(this.animationFrameId)
    }

    const analyzeFrame = () => {
      this.analyze()
      this.animationFrameId = globalThis.requestAnimationFrame(analyzeFrame)
    }

    this.animationFrameId = globalThis.requestAnimationFrame(analyzeFrame)
  }

  setVolume (value) {
    if (!this.isStopped) return
    this.gainNode.gain.value = value
  }

  async stop ({ destroy } = {}) {
    this.isStopped = true

    if (this.animationFrameId) {
      globalThis.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.onAudioLevelChange) {
      this.onAudioLevelChange(0)
    }

    if (this.audioContext) {
      await this.audioContext.suspend()
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
    }

    if (this.timeout) {
      clearInterval(this.timeout)
      this.timeout = null
    }

    if (!destroy) return

    if (this.mediaStream) {
      this.mediaStream = null
    }

    if (this.pcmNode) {
      this.pcmNode.port.onmessage = null
      this.pcmNode.disconnect()
      this.pcmNode = null
    }

    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}
