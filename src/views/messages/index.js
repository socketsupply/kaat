import { components } from '../../lib/components.js'
import process from 'socket:process'

let isPanning = false

components.messages = function () {
  const elMain = document.querySelector('main')
  const elBuffer = document.getElementById('message-buffer')
  const elSidebar = document.getElementById('sidebar')
  const elSidebarToggle = document.getElementById('sidebar-toggle')

  this.axis = 'X',
  this.absolute = true

  this.position = pos => {
    const progress = pos / 280
    const scale = 0.95 + 0.05 * progress
    const opacity = 0.0 + 1 * progress
    elSidebar.style.transform = `scale(${Math.min(scale, 1)})`
    elSidebar.style.opacity = opacity
    elSidebar.style.transformOrigin = '20% 70%'
  }

  this.begin = event => {
    elBuffer.style.overflow = 'auto'

    if (document.body.getAttribute('keyboard') === 'true') {
      this.isInteractive = false
    }

    if (['BUTTON', 'INPUT'].includes(event.target.tagName)) {
      this.isInteractive = false
    }
  }

  this.during = event => {
    const isLinear = this.angle < 45 || this.angle > 135
    const isSignificant = this.dx > 10 || this.dy > 10

    if (isLinear && isSignificant) {
      isPanning = true
      elBuffer.style.overflow = 'hidden'
      
    } else if (!isPanning) {
      return // its either an angular or trivial movement, ignore
    }

    if (isPanning) {
      const dx = this.clientX - this.startX;
      this.updatePosition('X', Math.max(0, Math.min(dx, 280)));
    }
  }

  this.end = event => {
    const interactionDuration = Date.now() - this.startTime
    const movedDistance = Math.abs(this.clientX - this.startX)

    // it's a tap!
    if (movedDistance < 10 && interactionDuration < 200) {
      return
    }

    if (isPanning) {
      if (this.currentX < (280 / 2)) {
        elSidebarToggle.setAttribute('open', 'false')
        this.start(0)
      } else {
        elSidebarToggle.setAttribute('open', 'true')
        this.start(280)
      }
    }
    
    isPanning = false
  }

  this.complete = () => {
    elBuffer.style.overflow = 'auto'
  }

  this.addMessage = (...args) => {
    // this.appendChild(...args)
  }
}

