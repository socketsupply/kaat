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
  llm = window.llm = new LLM({
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

  let elCurrentMessage = null

  llm.on('end', () => {
    //
    // TODO(@heapwolf): broadcast the last message generated to the network as if @ai was a real user on this device.
    //
    llm.stop()
    elCurrentMessage = null
  })

  llm.on('log', data => {
    console.log(data)
  })

  llm.on('data', data => {
    if (data === '<dummy32000>' || data === '<|user|>') {
      llm.stop()
      return
    }

    //
    // We could speak the generated text using the Speech API.
    //
    /*
      const utterance = new SpeechSynthesisUtterance(data)
      utterance.pitch = 1
      utterance.rate = 1
      utterance.volume = 1
      window.speechSynthesis.speak(utterance)
    */

    if (!elCurrentMessage) {
      data = data.trim()

      const messagesContainer = document.querySelector('#message-buffer .buffer-content')
      const elCurrentMessageWrapper = document.createElement('div')
      elCurrentMessageWrapper.classList.add('message-wrapper')
 
      elCurrentMessage = document.createElement('div')
      elCurrentMessage.classList.add('message')

      elCurrentMessageWrapper.append(elCurrentMessage)
      messagesContainer.prepend(elCurrentMessageWrapper)
    }

    elCurrentMessage.appendChild(document.createTextNode(data))
  })

  const elSendMessage = document.getElementById('send-message')
  const elInputMessage = document.getElementById('input-message')

  const send = () => {
    const messagesContainer = document.querySelector('#message-buffer .buffer-content')
    const elCurrentMessageWrapper = document.createElement('div')
    elCurrentMessageWrapper.classList.add('message-wrapper')
    elCurrentMessageWrapper.classList.add('mine')

    const elCurrentMessage = document.createElement('div')
    elCurrentMessage.classList.add('message')

    const text = elInputMessage.innerText.trim()

    if (!text.length) return // dont send empty chats

    elCurrentMessage.innerText = text

    // elCurrentMessageWrapper.append(new XAvatar())

    //
    // append the message containers to the messages container
    //
    elCurrentMessageWrapper.prepend(elCurrentMessage)
    messagesContainer.prepend(elCurrentMessageWrapper)

    //
    // tell the LLM to stfu
    //
    if (/^stop$/.test(text.trim())) {
      llm.stop()
      elInputMessage.textContent = ''
      return
    }

    // only chat to @ai when it's mentioned.
    if (/^@ai /.test(text.trim())) {
      llm.chat(text)
    }

    //
    // TODO(@heapwolf): broadcast the message to the network
    //
    elInputMessage.textContent = ''
  }

  //
  // Handle paste elegantly (stripping formatting, but preserving whitespace)
  //
  elInputMessage.addEventListener('paste', e => {
    e.preventDefault()

    const clipboardData = e.clipboardData || window.clipboardData
    let text = clipboardData.getData('Text')

    const sanitizedHTML = text
      .replace(/ /g, '&nbsp;') // Preserve spaces
      .replace(/\n/g, '<br>'); // Preserve newlines

    const selection = window.getSelection()
    if (!selection.rangeCount) return false
    
    const range = selection.getRangeAt(0)
    range.deleteContents()

    const fragment = document.createDocumentFragment()
    const div = document.createElement('div')
    div.innerHTML = sanitizedHTML

    while (div.firstChild) {
      fragment.appendChild(div.firstChild)
    }

    range.insertNode(fragment)
    range.collapse(false)
  })

  //
  // On desktop, enter should send, but shift-enter should create a new line.
  //
  elInputMessage.addEventListener('keydown', e => {
    if (isMobile) return // only the button should send on mobile
    if (e.key === 'Enter' && !e.shiftKey) send()
  })

  elSendMessage.addEventListener('click', send)
})
