import { Register } from '../lib/component.js'

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
    this.classList.add('open')

    // Add event listener for Escape key
    escapeListener = (event) => {
      if (event.key === 'Escape') {
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
          span({ class: 'title' }, props.title || 'Dialog'),
          button({ class: 'close' },
            svg({ class: 'app-icon' },
              use({ 'xlink:href': '#close-icon' })
            )
          )
        ),
        main({ class: 'content' }, ...children),
        footer(buttons.map(config =>
          button({ data: { value: config.value } }, config.label)
        ))
      )
    )
  )
}

Modal = Register(Modal)

export { Modal }
