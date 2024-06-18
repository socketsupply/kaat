import { Register } from '../lib/component.js'
import { Button } from './button.js'

function Preview (props, ...children) {
  let escapeListener

  const close = () => {
    this.classList.remove('open')
    this.classList.add('close')

    const animationend = () => {
      this.classList.remove('close')
      this.removeEventListener('animationend', animationend)
    }

    this.addEventListener('animationend', animationend)

    // Remove event listener for Escape key
    window.removeEventListener('keydown', escapeListener)
  }

  Object.defineProperty(this, 'value', {
    set: (v) => {
      const newImage = new Image()
      const container = this.querySelector('.image')

      if (typeof v === 'string') {
        newImage.src = v
      } else {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        canvas.width = v.width
        canvas.height = v.height

        ctx.drawImage(v, 0, 0, v.width, v.height)

        newImage.src = canvas.toDataURL()
      }

      container.innerHTML = ''
      container.appendChild(newImage)
    },
    enumerable: true,
    configurable: true
  })

  this.open = async () => {
    requestAnimationFrame(() => {
      this.classList.add('open')
    })

    // Add event listener for Escape key
    escapeListener = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', escapeListener)
  }

  this.close = () => close()

  const onclick = () => close()

  return div({ class: 'overlay', onclick },
    button({ class: 'close' },
      svg({ class: 'app-icon' },
        use({ 'xlink:href': '#close-icon' })
      )
    ),
    div({ class: 'image' })
  )
}

Preview = Register(Preview)

export { Preview }
