class PCMProcessor extends globalThis.AudioWorkletProcessor {
  process (inputs, outputs, parameters) {
    const input = inputs[0]

    if (input.length > 0) {
      const audioData = input[0]
      const int16Array = new Int16Array(audioData.length)

      for (let i = 0; i < audioData.length; i++) {
        int16Array[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7FFF
      }

      // approximately 344 times per second
      this.port.postMessage(Array.from(int16Array))
    }
    return true
  }
}

globalThis.registerProcessor('pcm-processor', PCMProcessor)
