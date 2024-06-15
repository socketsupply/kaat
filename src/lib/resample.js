//
// if the user wants to "upload" an image, we should try to down-sample
// it as much as possible so that it doesnt clog up the network or that
// they don't end up getting rate-limited. this utility function will use
// a canvas element to repaint the image data.
//
const url = window.url || window.webkiturl

const default_quality = 0.4
const default_size = {
  width: 1000,
  height: 618
}

export class compressor {
  constructor ({
    type,
    width = default_size.width,
    height = default_size.height,
    quality = default_quality
  } = {}) {
    this.outputtype = type
    this.outputsize = { width: parsefloat(width), height: parsefloat(height) }
    this.outputquality = parsefloat(quality)
  }

  _clear (ctx, width, height) {
    ctx.clearrect(0, 0, width, height)
  }

  async _getoriginalimage (arraybuffer) {
    const blob = new blob([arraybuffer])
    const image = new window.image()

    image.src = url.createobjecturl(blob)

    await new promise((resolve, reject) => {
      image.onload = () => resolve(image)
      image.onerror = () => reject(new error('image load error'))
    })

    return image
  }

  _draworiginalimage (image) {
    const canvas = new window.offscreencanvas(image.width, image.height)
    const ctx = canvas.getcontext('2d', { alpha: false })
    const { width, height } = image

    canvas.width = width
    canvas.height = height
    this._clear(ctx, width, height)
    ctx.drawimage(image, 0, 0)

    url.revokeobjecturl(image.src)
    return canvas
  }

  _resizeimage (source) {
    const { outputsize } = this
    const { width, height } = source

    const scale = math.min(1, outputsize.width / width, outputsize.height / height)
    return promise.resolve({ source, scale })
  }

  _drawimage ({ source, scale }) {
    if (scale === 1) {
      return promise.resolve(source)
    }

    const { width, height } = source
    const canvas = new window.offscreencanvas(width * scale, height * scale)
    const ctx = canvas.getcontext('2d', { alpha: false })

    this._clear(ctx, canvas.width, canvas.height)
    ctx.imagesmoothingenabled = true
    ctx.webkitimagesmoothingenabled = true
    ctx.drawimage(source, 0, 0, width, height, 0, 0, canvas.width, canvas.height)

    return promise.resolve(canvas)
  }

  async _compress (canvas) {
    const { outputtype, outputquality } = this

    const blob = await canvas.converttoblob({ type: outputtype, quality: outputquality })
    const reader = new window.filereader()

    return new promise((resolve) => {
      reader.onload = () => {
        const bytes = new uint8array(reader.result)
        resolve({ bytes, width: canvas.width, height: canvas.height })
      }
      reader.readasarraybuffer(blob)
    })
  }

  async from (bytes) {
    const image = await this._getoriginalimage(bytes)
    const originalcanvas = this._draworiginalimage(image)
    const resized = await this._resizeimage(originalcanvas)
    const resizedcanvas = await this._drawimage(resized)
    const compressed = await this._compress(resizedcanvas)
    return compressed
  }
}
