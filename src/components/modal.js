import { Register } from '../lib/component.js'
import { Button } from './button.js'

function Modal (props, ...children) {
  const {
    buttons = []
  } = props

  let escapeListener

  Object.defineProperty(this, 'value', {
    get: () => {
      const nodes = [...this.querySelectorAll('[data-slot]')]
      return Object.fromEntries(nodes.map(node => [node.dataset.slot, node.value]))
    },
    set: (o) => {
      if (!o) return

      const nodes = [...this.querySelectorAll('[data-slot]')]
      for (const [k, v] of Object.entries(o)) {
        const node = nodes.find(node => node.dataset.slot === k)
        if (node) node.value = v
      }
    },
    enumerable: true,
    configurable: true
  })

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

  this.on('click', (event, is) => {
    switch (true) {
      case !!is('button.close'): {
        close()
        break
      }
      case !!is('[data-value]'): {
        this.resolve(is('[data-value]').dataset.value)
        close()
        break
      }
    }
  })

  this.open = async () => {
    if (this.promise) this.resolve()
    
    const { promise, resolve } = Promise.withResolvers()
    this.resolve = resolve
    this.promise = promise

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
    return promise
  }

  this.close = async () => {
    close()
    this.resolve()
  }

  return (
    div({ class: 'overlay' },
      div({ class: 'dialog' },
        header({ class: 'draggable' },
          span({ class: 'spacer' }),
          span({ class: 'title' }, props.header || 'Dialog'),
          button({ class: 'close' },
            svg({ class: 'app-icon' },
              use({ 'xlink:href': '#close-icon' })
            )
          )
        ),
        main({ class: 'content' }, ...children),
        footer(buttons.map(config =>
          Button({ class: config.class, data: { value: config.value, event: config.event } }, config.label)
        ))
      )
    )
  )
}

Modal = Register(Modal)

export { Modal }
