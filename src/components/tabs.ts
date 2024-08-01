import { component } from '../lib/component.js'

/*
 * Tabs(
 *  Tabs.Tab({ id: 'foo' }),
 *  Tabs.Tab({ id: 'bar' }),
 *
 *  Tabs.Panel({ for: 'foo' },
 *    div('content a')
 *  ),
 *  Tabs.Panel({ for: 'bar' },
 *    div('content b')
 *  )
 * )
 */
function Tabs (props, ...children) {
  this.selectTab = id => {
    const panels = [...this.querySelectorAll('panel')]
    const tabs = [...this.querySelectorAll('panel')]

    for (const el of tabs) {
      const method = el.id === id ? 'add' : 'remove'
      el.classList[method]('selected')
    }

    const panel = this.querySelector(`panel[for=${id}]`)

    if (!panel) {
      throw new Error(`<tab id="${id}"> has no matching <panel>`)
    }

    for (const el of panels) {
      const method = el.getAttribute('for') === id ? 'add' : 'remove'
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

function Tab (props, ...children) {
  Object.assign(this, props)
  return children
}

Tabs.Tab = component(Tab)

function Panel (props, ...children) {
  Object.assign(this, props)
  return children
}

Tabs.Panel = component(Panel)

//
// As per React's "one component export per file",
// only the Tabs module is exported, and the other
// components are added to it, becoming namespaced.
//
export default component(Tabs)

