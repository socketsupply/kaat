import process from 'socket:process'

import { createComponent } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'
import { Avatar } from '../../components/avatar.js'

async function Messages (props) {
  const { net, llm, isMobile } = props

  //
  // Cache elements that we will touch frequently with the interaction/animation.
  //
  let elBuffer
  let elSidebar
  let elSidebarToggle

  let isPanning = false

  //
  // Enable some fun interactions on the messages element
  //

  const spring = new Spring(this, {
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
      if (!elBuffer) {
        elBuffer = document.getElementById('message-buffer')
        elSidebar = document.getElementById('sidebar')
        elSidebarToggle = document.getElementById('sidebar-toggle')
      }

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

  this.start = spring.start.bind(spring)
  this.updateTransform = spring.updateTransform.bind(spring)

  /* function createMessage (opts) {
    const elWrapper = document.createElement('div')
    elWrapper.classList.add('message-wrapper')
    if (opts.mine) elWrapper.classList.add('mine')

    elWrapper.append(new Avatar({
      nick: 'ai'
    }))

    const elMessage = document.createElement('div')
    elMessage.classList.add('message')

    elWrapper.append(elMessage)
    elMessages.prepend(elWrapper)

    return elMessage
  } */

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
      data = data.trim() // first token should not be empty
      if (data) elCurrentMessage = createMessage()
    }

    if (elCurrentMessaeg) { // just update the last message
      elCurrentMessage.appendChild(document.createTextNode(data))
    }
  })

  const onSendPress = () => {
    const elInputMessage = document.getElementById('input-message')
    const data = elInputMessage.innerText.trim()

    elCurrentMessage = createMessage({ data, mine: true })
    if (!elCurrentMessage) return

    elCurrentMessage.innerText = data

    //
    // tell the LLM to stfu
    //
    if (/^stop$/.test(data.trim())) {
      llm.stop()
      elInputMessage.textContent = ''
      return
    }

    // only chat to @ai when it's mentioned.
    if (/^@ai /.test(data.trim())) {
      llm.chat(data)
    }

    //
    // TODO(@heapwolf): broadcast the message to the subcluster
    //
    elInputMessage.textContent = ''
  }

  //
  // Handle paste elegantly (stripping formatting, but preserving whitespace)
  //
  function paste (e) {
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
  }

  //
  // On desktop, enter should send, but shift-enter should create a new line.
  //
  function keydown (e) {
    if (isMobile) return // only the button should send on mobile
    if (e.key === 'Enter' && !e.shiftKey) onSendPress()
  }

  function click (e) {
    onSendPress()
  }

  //
  // Passing a function to the render tree will be observed for that element.
  // The deeper the event is placed in the tree, the more specific it will be
  // and the sooner it will fire.
  //
  return [
    header({ class: 'primary draggable' },
      span({ class: 'title' }, '#P2P')
    ),
    div({ class: 'content' },

      //
      // The messages area
      //
      div({ class: 'buffer-wrapper' },
        div({ id: 'message-buffer' },
          div({ class: 'buffer-content' })
        )
      ),

      //
      // The input area
      //
      div({ id: 'input' },

        div({ id: 'input-message', contenteditable: 'true', keydown, paste }),

        button({ id: 'send-message', click },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#send-icon' })
          )
        )
      )
    )
  ]
}

const messages = createComponent(Messages)
export { messages as Messages }
