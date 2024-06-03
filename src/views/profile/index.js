import process from 'socket:process'

import { Register } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'

async function Profile (props) {
  const vProfilePositionTop = props.isMobile ? 90 : 48
  const vProfileTransformOrigin = props.isMobile ? 100 : 80
  const vProfileTransformMag = props.isMobile ? 0.5 : 0.08

  let elMain

  const spring = new Spring(this, {
    axis: 'Y',
    absolute: true,
    position: function (pos) {
      const progress = pos / window.innerHeight
      const topProgress = vProfilePositionTop / window.innerHeight

      // Opacity calculation adjusted to be 1 at vProfilePositionTop
      const opacity = Math.max(0, 1 - (2.5 * (progress - topProgress)))
      this.el.style.opacity = Math.min(1, Math.max(0, opacity))

      const scale = 0.9 + (0.1 * progress ** vProfileTransformMag)

      if (!elMain) {
        elMain = document.getElementById('main')
      }

      elMain.style.transform = `scale(${Math.min(scale, 1)})`
      elMain.style.transformOriginY = `${vProfileTransformOrigin}%`
    },
    during: function (event) {
      if (this.dy < 40) return // Ignore upward movements for pull-to-dismiss functionality

      const newPosition = Math.min(this.el.clientHeight, Math.max(vProfilePositionTop, this.dy))
      this.updatePosition('Y', newPosition)
    },
    end: function (event) {
      // Determine the final action based on the dragged distance
      const finalPosition = this.currentY
      const divHeight = this.el.clientHeight
      const threshold = divHeight / 2 // Example: 50% of the element's height

      if (Math.abs(finalPosition) < threshold) {
        // If not dragged past the threshold, start the spring animation to snap back
        this.moveTo(vProfilePositionTop)  // Snap back to the original position
      } else {
        // If dragged past the threshold, start the spring animation to dismiss or finalize the action
        this.moveTo(window.innerHeight) // Or any other final position based on your use case
      }
    }
  })

  this.moveTo = spring.moveTo.bind(spring)
  this.updateTransform = spring.updateTransform.bind(spring)

  //
  // Handle the close button
  //
  const click = (event, match) => {
    if (match('#profile-close')) {
      spring.moveTo(window.innerHeight)
    }
  }

  return [
    header({ class: 'draggable' },
      span('Profile'),
      button({ id: 'profile-close', click },
        svg({ class: 'app-icon' },
          use({ 'xlink:href': '#close-icon' })
        )
      )
    ),
    div({ class: 'content' })
  ]
}

Profile = Register(Profile)
export { Profile }
