export class Spring {
  /**
   * Current X position.
   * @type {number}
   */
  currentX = 0

  /**
   * Current Y position.
   * @type {number}
   */
  currentY = 0

  /**
   * Last velocity in the X direction.
   * @type {number}
   */
  lastVelocityX = 0

  /**
   * Last velocity in the Y direction.
   * @type {number}
   */
  lastVelocityY = 0

  /**
   * Timing step for the spring calculation.
   * @type {number}
   */
  stepTiming = 4

  /**
   * ID of the current animation frame.
   * @type {number|null}
   */
  animationFrameId = null

  /**
   * Indicates if the element is interactive.
   * @type {boolean}
   */
  isInteractive = false

  /**
   * Indicates if interaction is allowed.
   * @type {boolean}
   */
  allowInteraction = true

  /**
   * Create a SpringView.
   * @param {Object} [opts={}] - Options for the animation.
   */
  constructor (el, opts = {}) {
    if (!el) {
      console.log(el)
      throw new Error('Element requred')
    }
    if (el.axis) return

    this.el = el
    this.opts = opts
    this.axis = opts.axis

    opts.updateType = opts.updateType ?? 'absolute'

    const begin = e => this.onBegin(e, opts.begin)
    const during = e => this.onDuring(e, opts.during)
    const end = e => this.onEnd(e, opts.end)

    this.el.addEventListener('mousedown', begin)
    this.el.addEventListener('touchstart', begin)

    document.addEventListener('mousemove', during)
    document.addEventListener('touchmove', during)
    document.addEventListener('mouseup', end)
    document.addEventListener('touchend', end)
  }

  /**
   * Step function for spring calculation.
   * @param {Object} config - Configuration for the spring step.
   * @private
   */
  #step (config) {
    const t = this.stepTiming / 420 // seconds
    const { pos, dest, v, k, b } = config
    const Fspring = -k * (pos - dest) // the spring force
    const Fdamper = -b * v // damping force
    const a = Fspring + Fdamper // acceleration
    const deltaV = a * t // change in velocity
    const deltaPos = v * t + 0.5 * a * t * t // position using basic kinematics equation

    config.v += deltaV // update velocity
    config.pos += deltaPos // update position
  }

  /**
   * Handler for the begin of an interaction.
   * @param {Event} event - The event object.
   * @param {Function} [fn] - Optional callback function.
   */
  onBegin (event, fn) {
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId)
    }

    this.updateCurrentXandY(event)
    this.allowInteraction = true
    this.isInteractive = true

    this.updateTransform()
    this.startX = this.clientX - this.currentX
    this.startY = this.clientY - this.currentY
    this.startTime = Date.now()

    if (fn) fn.call(this, event)
  }

  /**
   * Handler for interactions during an interaction.
   * @param {Event} event - The event object.
   * @param {Function} [fn] - Optional callback function.
   */
  onDuring (event, fn) {
    if (!event.buttons && event.type === 'mousemove') return
    if (!this.isInteractive || !this.allowInteraction) return

    const now = Date.now()
    this.updateCurrentXandY(event)

    this.dx = Math.abs(this.clientX - (this.startX || 0))
    this.dy = Math.abs(this.clientY - (this.startY || 0))

    this.angle = Math.atan2(this.dy, this.dx) * 180 / Math.PI

    // Calculate instant velocity
    const timeDiff = now - this.lastTime
    if (timeDiff > 0) { // Avoid division by zero
      const velocityX = (this.clientX - this.lastX) / timeDiff
      const velocityY = (this.clientY - this.lastY) / timeDiff
      this.lastVelocityX = velocityX
      this.lastVelocityY = velocityY
    }

    this.lastX = this.clientX
    this.lastY = this.clientY
    this.lastTime = now

    if (fn) fn.call(this, event)
  }

  /**
   * Handler for the end of an interaction.
   * @param {Event} event - The event object.
   * @param {Function} [fn] - Optional callback function.
   */
  onEnd (event, fn) {
    if (!this.isInteractive || !this.allowInteraction) return
    this.isInteractive = false
    this.updateTransform()

    if (fn) fn.call(this, event)
  }

  /**
   * Update current X and Y coordinates from the event.
   * @param {Event} [event={}] - The event object.
   */
  updateCurrentXandY (event = {}) {
    if (event.type.includes('mouse')) {
      this.clientY = event.clientY
      this.clientX = event.clientX
    } else if (event.touches) {
      this.clientY = event.touches[0].clientY
      this.clientX = event.touches[0].clientX
    }

    this.currentY = this.clientY - (this.startY || 0)
    this.currentX = this.clientX - (this.startX || 0)
  }

  /**
   * Get the current transform values of the element.
   * @returns {{currentX: number, currentY: number}} The current X and Y transform values.
   */
  getTransform () {
    const style = window.getComputedStyle(this.el).transform
    let currentX = 0
    let currentY = 0

    if (style !== 'none') {
      const matrix = new window.DOMMatrixReadOnly(style)
      currentX = matrix.m41
      currentY = matrix.m42
    }

    return { currentX, currentY }
  }

  /**
   * Update the current transform values of the element.
   */
  updateTransform () {
    const { currentX, currentY } = this.getTransform()

    this.currentX = currentX
    this.currentY = currentY
  }

  /**
   * Update the position of the element.
   * @param {string} axis - The axis to update ('X' or 'Y').
   * @param {number} pos - The position value.
   */
  updatePosition (axis, pos) {
    const property = axis === 'X' ? 'translateX' : 'translateY'

    if (this.opts.updateType === 'relative') {
      const unit = axis === 'X' ? 'vw' : 'vh'
      const viewportUnit = axis === 'X' ? window.innerWidth : window.innerHeight
      const posInViewportUnits = (pos / viewportUnit) * 100

      this.el.style.transform = `${property}(${posInViewportUnits}${unit})`
    } else if (this.opts.updateType === 'absolute') {
      this.el.style.transform = `${property}(${pos}px)`
    }

    if (this.opts.position) {
      this.opts.position.call(this, pos)
    }

    if (axis === 'X') {
      this.currentX = pos
    } else {
      this.currentY = pos
    }
  }

  /**
   * Start the spring animation.
   * @param {number} destination - The destination position.
   * @param {Object} [config={}] - Configuration for the animation.
   */
  moveTo (destination, config = {}) {
    this.updateTransform()
    const currentPosition = this.axis === 'X' ? this.currentX : this.currentY
    const initialVelocity = this.axis === 'X' ? this.lastVelocityX * 1000 : this.lastVelocityY * 1000

    config = {
      pos: currentPosition,
      dest: destination,
      v: initialVelocity,
      k: 290,
      b: 26,
      ...config
    }

    const animate = () => {
      this.#step(config)
      this.updatePosition(this.axis, config.pos)

      // ensure that the animation snaps to the closest endpoint (when its close enough)
      if (Math.abs(config.v) < 0.5 && Math.abs(config.pos - config.dest) < 1) {
        config.pos = config.dest // the destination
        this.updatePosition(this.axis, config.pos)
        window.cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null

        if (this.opts.complete) this.opts.complete.call(this)
      } else {
        this.animationFrameId = window.requestAnimationFrame(animate)
      }
    }

    if (this.animationFrameId) window.cancelAnimationFrame(this.animationFrameId)
    this.animationFrameId = window.requestAnimationFrame(animate)
  }

  /**
   * Stop the spring animation.
   */
  stop () {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
}

