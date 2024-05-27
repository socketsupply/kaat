import process from 'socket:process'
import { LLM } from 'socket:ai'
import { network } from './lib/network.js'
import { db } from './lib/data.js'

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

const llm = window.llm = new LLM({
  path: 'model.gguf',
  prompt: 'You are a coding assistant.'
})

let elCurrentMessage = null

llm.on('end', () => {
  elCurrentMessage = null
})

llm.on('data', data => {
  if (!elCurrentMessage) {
    const messagesContainer = document.querySelector('#message-buffer .buffer-content')
    elCurrentMessage = document.createElement('div')
    messageContainer.appendChild(elCurrentMessage)
  }

  elCurrentMessage.appendChild(document.createTextNode(data))
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
})
