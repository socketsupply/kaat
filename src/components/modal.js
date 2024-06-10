import { Register } from '../lib/component.js'
import { Button } from './button.js'

function Modal (props, ...children) {
  const {
    buttons = []
  } = props

  let escapeListener

  //
  // reparenting the component allows us to declare it
  // where ever we want but then ensure its global.
  //
  this.on('connected', event => {
    const el = this.parentNode.removeChild(this)
    document.body.appendChild(el)
  })

  //
  // This component implements a "slot pattern". When rendered,
  // it inserts the supplied tree into it's own tree. When the
  // .render method is called, it finds all the leaf nodes that
  // have slots and fills them with prop values. For example...
  //
  // // At the call site...
  //
  // myModal.render({ slots: { name: 'alice' })
  //
  // // At declartion...
  //
  // Modal({
  //   Text({ data: { slot: 'name' } })
  // })
  //
  this.on('updated', event => {
    if (!props.slots) return

    const nodes = [...this.querySelectorAll('[data-slot]')]

    for (const node of nodes) {
      const slot = node.dataset.slot
      if (props.slots[slot]) node.value = props.slots[slot]
    }
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
      div({ class: 'dialog', ...props },
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
          Button({ data: { value: config.value } }, config.label)
        ))
      )
    )
  )
}

Modal = Register(Modal)

export { Modal }
