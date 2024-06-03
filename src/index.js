import process from 'socket:process'
import application from 'socket:application'
import { LLM } from 'socket:ai'

import { network } from './lib/network.js'
import { database } from './lib/data.js'
import { createComponents, createRoot } from './lib/component.js'

import { Profile } from './views/profile/index.js'
import { Messages } from './views/messages/index.js'
import { Sidebar } from './views/sidebar/index.js'

//
// The main component, this is the program entry point.
//
async function App () {
  const isMobile = ['android', 'ios'].includes(process.platform)

  document.body.setAttribute('hardware', isMobile ? 'mobile' : 'desktop')
  document.body.setAttribute('platform', process.platform)

  //
  // Create an LLM that can partcipate in the chat.
  //
  const llm = new LLM({
    path: `model.gguf`,
    prompt: 'You are a coding assistant.'
  })

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
  function click (event, match) {
    const el = match('#sidebar-toggle')

    if (el) {
      const messages = document.getElementById('messages')

      if (el.getAttribute('open') === 'true') {
        messages.updateTransform()
        messages.start(0)
        el.setAttribute('open', 'false')
      } else {
        messages.start(280)
        el.setAttribute('open', 'true')
      }
    }
  }

  //
  // Things we want to share with other components.
  //
  const context = { db, net, llm, isMobile }

  //
  // Render the main screen.
  //
  return [
    main({ id: 'main', click },
      button({ id: 'sidebar-toggle' },
        svg({ class: 'app-icon rectangular' },
          use({ 'xlink:href': '#sidebar-icon' })
        )
      ),
      await Messages({ id: 'messages', class: 'view', ...context }),
      await Sidebar({ id: 'sidebar', class: 'view', ...context })
    ),
    aside({ id: 'secondary', click },
      await Profile({ id: 'profile', class: 'view', ...context })
    )
  ]
}

document.addEventListener('DOMContentLoaded', async () => {
  createRoot(App, document.body)
  document.body.classList.remove('loading')
})
