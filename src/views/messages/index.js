import process from 'socket:process'

import { SpringView, Avatar } from '../../lib/components.js'

const view = {}

view.init = async ({ isMobile, llm }) => {
  const elMain = document.getElementById('main')
  const elBuffer = document.getElementById('message-buffer')
  const elSidebar = document.getElementById('sidebar')
  const elSidebarToggle = document.getElementById('sidebar-toggle')

  let isPanning = false

  //
  // Enable some fun interactions on the messages element
  //
  view.springView = new SpringView(document.getElementById('messages'), {
    axis: 'X',
    absolute: true,
    position: function (pos) {
      const progress = pos / 280
      const scale = 0.95 + 0.05 * progress
      const opacity = 0.0 + 1 * progress
      elSidebar.style.transform = `scale(${Math.min(scale, 1)})`
      elSidebar.style.opacity = opacity
      elSidebar.style.transformOrigin = '20% 70%'
    },
    begin: function (event) {
      elBuffer.style.overflow = 'auto'

      if (document.body.getAttribute('keyboard') === 'true') {
        this.isInteractive = false
      }

      if (['BUTTON', 'INPUT'].includes(event.target.tagName)) {
        this.isInteractive = false
      }
    },
    during: function (event) {
      const isLinear = this.angle < 45 || this.angle > 135
      const isSignificant = this.dx > 10 || this.dy > 10

      if (!isMobile) {
        const el = event.target
        if (el.closest('.message') || el.classList.contains('.message')) return
      }

      if (isLinear && isSignificant) {
        isPanning = true
        elBuffer.style.overflow = 'hidden'
      } else if (!isPanning) {
        return // its either an angular or trivial movement, ignore
      }

      if (isPanning) {
        const dx = this.clientX - this.startX;
        this.updatePosition('X', Math.max(0, Math.min(dx, 280)));
      }
    },
    end: function (event) {
      const interactionDuration = Date.now() - this.startTime
      const movedDistance = Math.abs(this.clientX - this.startX)

      // it's a tap!
      if (movedDistance < 10 && interactionDuration < 200) {
        return
      }

      if (isPanning) {
        if (this.currentX < (280 / 2)) {
          elSidebarToggle.setAttribute('open', 'false')
          this.start(0)
        } else {
          elSidebarToggle.setAttribute('open', 'true')
          this.start(280)
        }
      }

      isPanning = false
    },
    complete: function () {
      elBuffer.style.overflow = 'auto'
    }
  })

  //
  // Handle output from the LLM and input from the user.
  //
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
}

export { view as messages }
