import process from 'socket:process'
import application from 'socket:application'
import { LLM } from 'socket:ai'

import { network } from './lib/network.js'
import { database } from './lib/data.js'

import { profile } from './views/profile/index.js'
import { messages } from './views/messages/index.js'
import { sidebar } from './views/sidebar/index.js'

const isMobile = ['android', 'ios'].includes(process.platform)
let llm

//
// Any and all initializations that can happen before DOMContentLoaded.
//
async function init () {
  document.body.setAttribute('hardware', isMobile ? 'mobile' : 'desktop')
  document.body.setAttribute('platform', process.platform)

  //
  // Create an LLM that can partcipate in the chat.
  //
  llm = new LLM({
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
}

init()

//
// Everything that can only happen after the document is loaded.
//
document.addEventListener('DOMContentLoaded', async () => {
  //
  // Reveal the UI in a sexy way.
  //
  document.body.classList.remove('loading')

  //
  // Initialize the data layer.
  //
  const db = await database()

  //
  // Initialize the network with either new or existing data.
  //
  const net = await network(db)

  //
  // Shared referneces between all the application's views.
  //
  const views = { messages, profile, sidebar }
  const refs = { db, net, llm, isMobile, views }

  //
  // Initialize all views and pass them essential references
  //
  Promise.all(Object.values(views).map(v => v.init(refs)))
})
