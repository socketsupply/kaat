import process from 'socket:process'
import application from 'socket:application'

import { network } from './lib/network.js'
import { database } from './lib/data.js'
import { createRoot } from './lib/component.js'

import Messages from './views/messages/index.js'
import Profile from './views/profile/index.js'
import Sidebar from './views/sidebar/index.js'
import AudioStreams from './views/streams/audio.js'
import ModelManageChannel from './views/channels/manage.js'
import ModelCreateChannel from './views/channels/create.js'
import Preview from './components/preview.js'

//
// The main component, this is the program entry point.
//
async function App () {
  const isMobile = ['android', 'ios'].includes(process.platform)

  const vProfilePositionTop = isMobile ? 90 : 48

  document.body.setAttribute('hardware', isMobile ? 'mobile' : 'desktop')
  document.body.setAttribute('platform', process.platform)

  if (isMobile && process.platform === 'ios') {
    // For our UI design, subscribe to keyboard events. The layout should
    // change slightly when the input moves away from the bottom bevel.
    // @ts-ignore
    window.addEventListener('keyboard', ({ detail }) => {
      if (detail.value.event === 'will-show') {
        document.body.setAttribute('keyboard', 'true')
      }

      if (detail.value.event === 'will-hide') {
        document.body.removeAttribute('keyboard')
      }
    })
  }

  const setTheme = async () => {
    //
    // extract the current theme's background color from the CSS variable
    // and use it to set the color of the actual window.
    //
    const w = await application.getCurrentWindow()
    const styles = window.getComputedStyle(document.body)
    const rgba = styles.getPropertyValue('--x-window').trim()
    const { 0: red, 1: green, 2: blue, 3: alpha } = rgba.match(/\d+/g)

    // @ts-ignore
    w.setBackgroundColor({ red, green, blue, alpha })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTheme)

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
      Kaat:
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

  const pickerOpts = {
    types: [
      {
        description: 'Select A Model File',
        accept: {
        }
      }
    ],
    excludeAcceptAllOption: true,
    multiple: false
  }

  //
  // Pretty much a global click handler for anything in the app.
  //

  const onclick = async (event, match) => { 
    const el = match('[data-event]')

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

    if (el?.dataset.event === 'profile-open') {
      const elProfile = document.getElementById('profile')
      elProfile.moveTo(vProfilePositionTop)
    }

    if (el?.dataset.event === 'create-channel-open') {
      event.stopPropagation()

      const elModal = document.getElementById('create-channel')

      elModal.value = { 'accessToken': crypto.randomUUID() }

      const res = await elModal.open()

      if (res === 'ok') {
        await net.createChannel(elModal.value)
        const elChannels = document.querySelector('channels')
        elChannels.render()
      }

      return
    }

    if (el?.dataset.event === 'delete-channel') {
      console.log(el.dataset.value)
    }

    /* if (el?.dataset.event === 'change-model') {
      event.stopPropagation()

      const [fileHandle] = await window.showOpenFilePicker(pickerOpts)
      el.value = fileHandle.name
    } */

    if (el?.dataset.event === 'copy') {
      event.stopPropagation()
      event.preventDefault()

      const text = el.closest('text')
      await navigator.clipboard.writeText(text.value)
    }
  }

  //
  // Things we want to share with other components.
  //
  const context = { db, net, isMobile }

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
      await Sidebar({ id: 'sidebar', class: 'view', ...context }),
      ModelManageChannel(),
      ModelCreateChannel(),
      AudioStreams({ ...context }),
      Preview()
    )
  ]
}

document.addEventListener('DOMContentLoaded', () => {
  createRoot(App, document.body)

  // fade-in the UI gently
  document.body.classList.remove('loading')

  document.body.addEventListener('transitionend', () => {
    document.body.classList.add('loaded')
  })
})
