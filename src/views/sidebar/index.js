import process from 'socket:process'

import { createComponent } from '../../lib/component.js'

async function Sidebar (props) {
 
  this.addEventListener('ready', e => {
    // ...this component is ready
  })

  return [
    header({ class: 'primary draggable' },
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

const sidebar = createComponent(Sidebar)
export { sidebar as Sidebar }
