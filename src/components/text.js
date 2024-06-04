import { Register } from '../lib/component.js'

function Text (props, ...children) {
  const state = this.state = {}

  const styleInput = {
    borderRadius: `${props.radius || 6}px`
  }

  const el = input({ ...props, style: styleInput })

  this.focus = pos => {
    el.focus()

    try {
      el.setSelectionRange(pos, pos)
    } catch {}
  }

  this.setValid = () => {
    el.setCustomValidity('')
    el.removeAttribute('invalid')
  }

  this.setInvalid = msg => {
    this.setAttribute('edited', true)
    state.edited = true

    msg = msg || props.errorMessage

    el.setCustomValidity(msg)

    window.requestAnimationFrame(() => {
      el.setAttribute('invalid', msg)
    })

    const span = this.querySelector('.x--text-invalid span')
    span.textContent = msg

    const wrapper = this.querySelector('.x--text-invalid')
    wrapper.style.display = 'block'
  }

  this.on('focusin', event => {
    this.dispatchEvent(new window.CustomEvent('focus', { bubbles: true }))
  })

  this.on('focusout', event => {
    this.dispatchEvent(new window.CustomEvent('blur', { bubbles: true }))
  })

  this.on('input', event => {
    state.edited = true
    this.setAttribute('edited', true)
    state.value = event.target.value
    state.pos = event.target.selectionStart

    this.setValid()

    if (!event.target.checkValidity()) {
      this.setInvalid(props.errorMessage)
    }
  })

  this.focus(state.pos)

  const styleWrapper = {
    position: 'relative',
    display: 'inline-block',
    border: '1px solid var(--x-border)',
    ...styleInput
  }

  return (
    div({ class: 'wrapper', style: styleWrapper },
      props.label && label(props.label),
      props.icon && button({ class: 'close' },
        svg({ class: 'app-icon' },
          use({ 'xlink:href': `#${props.icon}` })
        )
      ),
      el,
      div({ class: 'x--text-invalid' },
        span({ id: `x--text-error-${props.id}` }, props.errorMessage)
      )
    )
  )
}

Text = Register(Text)
export { Text }
