import process from 'socket:process'

import { Register } from '../../lib/component.js'

async function Sidebar (props) {
  const vProfilePositionTop = props.isMobile ? 90 : 48
  const vProfileTransformOrigin = props.isMobile ? 100 : 80
  const vProfileTransformMag = props.isMobile ? 0.5 : 0.08

  this.addEventListener('ready', e => {
    // ...this component is ready
  })

  function click (event, match) {
    if (match('#profile-open')) {
      const elProfile = document.getElementById('profile')
      elProfile.moveTo(vProfilePositionTop)
    }
  }

  return [
    header({ class: 'primary draggable', click },
      div({ class: 'content' },
        button({ id: 'add-group' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#plus-icon' })
          )
        ),
        button({ id: 'profile-open' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#profile-icon' })
          )
        )
      )
    ),
    div({ class: 'content' },
      div({ class: 'group' },
        span({}, 'Socket Supply'),
        button({ id: 'add-channel' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#plus-icon' })
          )
        )
      ),
      div({ class: 'channel' }, '#P2P'),
      div({ class: 'group' }, 'Fork Town'),
      div({ class: 'channel' }, '#Frontend'),
      div({ class: 'channel' }, '#Gaming')
    )
  ]
}

Sidebar = Register(Sidebar)
export { Sidebar }
