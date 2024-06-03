import { createComponent } from '../lib/component.js'

function Avatar (root, props) {
  const MAGIC_NUMBER = 5
  const userColors = {}
  const bg = userColors[props.nick] ??= Math.floor(Math.random() * 20)

  function createIcon(id = 'anonymous') {
    const element = document.createElement('div')

    const hash = id.split('').reduce((hash, char) => 
      (hash ^ char.charCodeAt(0)) * -MAGIC_NUMBER, MAGIC_NUMBER) >>> 2

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '-1.5 -1.5 8 8')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.setAttribute('fill', props.fill ?? '#666')
    svg.setAttribute('title', id)

    for (let i = 0; i < 25; i++) {
      if (hash & (1 << (i % 15))) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', `${i > 14 ? 7 - Math.floor(i / 5) : Math.floor(i / 5)}`)
        rect.setAttribute('y', `${i % 5}`)
        rect.setAttribute('width', '1')
        rect.setAttribute('height', '1')
        svg.appendChild(rect)
      }
    }

    element.appendChild(svg)
    return element
  }

  return (
    div({ class: 'icon' },
      div({ class: 'icon', style: { backgroundColor: `var(--relay-avatar-bg-${bg})` } },
        createIcon(props.nick)
      )
    )
  )
}

const avatar = createComponent(Avatar)
export { avatar as Avatar }
