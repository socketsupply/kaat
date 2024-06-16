const URL = window.URL || window.webkitURL

const DEFAULT_QUALITY = 0.4
const DEFAULT_SIZE = {
  width: 1000,
  height: 618
}

export class Compressor {
  constructor ({
    type,
    width = DEFAULT_SIZE.width,
    height = DEFAULT_SIZE.height,
    quality = DEFAULT_QUALITY
  } = {}) {
    this.outputType = type
    this.outputSize = { width: parseFloat(width), height: parseFloat(height) }
    this.outputQuality = parseFloat(quality)
  }

  _clear (ctx, width, height) {
    ctx.clearRect(0, 0, width, height)
  }

  async _getOriginalImage (arrayBuffer) {
    const blob = new Blob([arrayBuffer])
    const image = new window.Image()

    image.src = URL.createObjectURL(blob)

    await new Promise((resolve, reject) => {
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image load error'))
    })

    return image
  }

  _drawOriginalImage (image) {
    const canvas = new window.OffscreenCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d', { alpha: false })
    const { width, height } = image

    canvas.width = width
    canvas.height = height
    this._clear(ctx, width, height)
    ctx.drawImage(image, 0, 0)

    URL.revokeObjectURL(image.src)
    return canvas
  }

  _resizeImage (source) {
    const { outputSize } = this
    const { width, height } = source

    const scale = Math.min(1, outputSize.width / width, outputSize.height / height)
    return Promise.resolve({ source, scale })
  }

  _drawImage ({ source, scale }) {
    if (scale === 1) {
      return Promise.resolve(source)
    }

    const { width, height } = source
    const canvas = new window.OffscreenCanvas(width * scale, height * scale)
    const ctx = canvas.getContext('2d', { alpha: false })

    this._clear(ctx, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = true
    ctx.webkitImageSmoothingEnabled = true
    ctx.drawImage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height)

    return Promise.resolve(canvas)
  }

  async _compress (canvas) {
    const { outputType, outputQuality } = this

    const blob = await canvas.convertToBlob({ type: outputType, quality: outputQuality })
    const reader = new window.FileReader()

    return new Promise((resolve) => {
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result)
        resolve({ bytes, width: canvas.width, height: canvas.height })
      }
      reader.readAsArrayBuffer(blob)
    })
  }

  async from (bytes) {
    const image = await this._getOriginalImage(bytes)
    const originalCanvas = this._drawOriginalImage(image)
    const resized = await this._resizeImage(originalCanvas)
    const resizedCanvas = await this._drawImage(resized)
    const compressed = await this._compress(resizedCanvas)
    return compressed
  }
}
