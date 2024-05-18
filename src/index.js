import process from 'socket:process'
import { network } from './lib/network.js'
// import { db } from './lib/data.js'

import './views/profile/index.js'
import './views/messages/index.js'
import './views/sidebar/index.js'

let isMobile = false

function addPlaceholderData () {
  const messagesContainer = document.querySelector('#message-buffer .buffer-content')

  for (let i = 1; i <= 256; i++) {
    const message = document.createElement('div')
    message.innerText = `Message ${i}`
    message.style.height = `${Math.random() * 100 + 20}px`
    messagesContainer.appendChild(message)
  }
}

//
// A long scroll event can block the keyboard show event
// The way to ensure this doesn't happen is to just temporarily
// assign hidden to the overflow that is causing the scroll.
//
function addScrollCancel () {
  /* if (!isMobile) return

  const elBuffer = document.getElementById('message-buffer')
  const elInput = document.getElementById('input')

  elInput.addEventListener('click', () => {
    elBuffer.style.overflowY = 'hidden'

    setTimeout(() => {
      elBuffer.style.overflowY = 'auto'
    }, 128)
  }) */
}

//
// We want to know if the keyboard is displayed, the layout should
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

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('platform', process.platform)

  if (['android', 'ios'].includes(process.platform)) {
    isMobile = true
    document.body.setAttribute('hardware', 'mobile')
  } else {
    document.body.setAttribute('hardware', 'desktop')
  }

  addPlaceholderData()
  addScrollCancel(isMobile)
})
