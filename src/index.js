import process from 'socket:process'
import application from 'socket:application'

import { network } from './lib/network.js'
import { database } from './lib/data.js'
import { createRoot } from './lib/component.js'

import { Messages } from './views/messages/index.js'
import { Profile } from './views/profile/index.js'
import { Sidebar } from './views/sidebar/index.js'

import { Modal } from './components/modal.js'
import { Text } from './components/text.js'

//
// The main component, this is the program entry point.
//
async function App () {
  const isMobile = ['android', 'ios'].includes(process.platform)

  document.body.setAttribute('hardware', isMobile ? 'mobile' : 'desktop')
  document.body.setAttribute('platform', process.platform)

  if (isMobile && process.platform === 'ios') {
    //
    // For our UI design, subscribe to keyboard events. The layout should
    // change slightly when the input moves away from the bottom bevel.
    //
    window.addEventListener('keyboard', ({ detail }) => {
      if (detail.value.event === 'will-show') {
        document.body.setAttribute('keyboard', 'true')
      }

      if (detail.value.event === 'will-hide') {
        document.body.setAttribute('keyboard', 'false')
      }
    })
  }

  //
  // System menus
  //
  if (!isMobile) {
    let itemsMac = ''

    if (process.platform === 'darwin') {
      itemsMac = `
        Hide: h + CommandOrControl
        Hide Others: h + Control + Meta
        ---
      `
    }

    const menu = `
      Relay:
        About Kaat: _
        Settings...: , + CommandOrControl
        ---
        ${itemsMac}
        Quit: q + CommandOrControl
      ;

      Edit:
        Cut: x + CommandOrControl
        Copy: c + CommandOrControl
        Paste: v + CommandOrControl
        Delete: _
        Select All: a + CommandOrControl
      ;

      View:
        Toggle Panel: k + CommandOrControl
        Toggle Console: p + CommandOrControl
      ;

      Upload:
        Attachment...: _
      ;
    `

    await application.setSystemMenu({ index: 0, value: menu })
  }

  //
  // Initialize the data layer.
  //
  const db = await database()

  //
  // Initialize the network with either new or existing data.
  //
  const net = await network(db)

  //
  // Pretty much a global click handler for anything in the app.
  //
  const onclick = async (event, match) => {
    const el = match('[data-event]')

    if (el?.dataset.event === 'change-model') {
      const [fileHandle] = await window.showOpenFilePicker(pickerOpts)

      console.log('SWAP THE MODEL', fileHandle)
    }

    if (el?.dataset.event === 'sidebar-toggle') {
      const messages = document.getElementById('messages')

      if (el.getAttribute('open') === 'true') {
        messages.updateTransform()
        messages.moveTo(0)
        el.setAttribute('open', 'false')
      } else {
        messages.moveTo(280)
        el.setAttribute('open', 'true')
      }
    }
  }

  //
  // Things we want to share with other components.
  //
  const context = { db, net, isMobile }

  const pickerOpts = {
    types: [
      {
        description: 'Select A Model File',
        accept: {
          '*/*': ['.gguf']
        }
      }
    ],
    excludeAcceptAllOption: true,
    multiple: false
  }

  //
  // Render the main screen.
  //
  return [
    aside({ id: 'secondary', onclick },
      await Profile({ id: 'profile', class: 'view', ...context })
    ),
    main({ id: 'main', onclick },
      button({ id: 'sidebar-toggle', data: { event: 'sidebar-toggle' } },
        svg({ class: 'app-icon rectangular' },
          use({ 'xlink:href': '#sidebar-icon' })
        )
      ),
      await Messages({ id: 'messages', class: 'view', ...context }),
      await Sidebar({ id: 'sidebar', class: 'view', ...context })
    )
  ]
}

document.addEventListener('DOMContentLoaded', () => {
  createRoot(App, document.body)
  document.body.classList.remove('loading')
})
