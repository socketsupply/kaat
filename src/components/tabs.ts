import { Register } from '../lib/component.js'

function Tab(props, ...children) {
  Object.assign(this, props)
  return children
}

Tab = Register(Tab)

function Tabs(props, ...children) {
  const { activeTabId } = props

  this.selectTab = id => {
    const panels = [...this.querySelectorAll('panel')]
    const tabs = [...this.querySelectorAll('panel')]

    for (const el of tabs) {
      const method = el === elTab.id ? 'add' : 'remove'
      el.classList[method]('selected')
    }

    const panel = this.querySelector(`panel[for=${elTab.id}]`)

    if (!panel) {
      throw new Error(`<tab id="{elTab.id}"> has no matching <panel>`)
    }

    for (const el of panels) {
      const method = el.getAttribute('for') === elTab.id ? 'add' : 'remove'
      el.classList[method]('selected')
    }
  }

  this.on('click', (event, match) => {
    const elTab = match('tab')
    if (!elTab) return

    this.selectTab(elTab.id)
  })

  return children
}

Tabs = Register(Tabs)

function Panel(props, ...children) {
  Object.assign(this, props)
  return children
}

Panel = Register(Panel)

export { Tab, Tabs, Panel }
