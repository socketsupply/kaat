import process from 'socket:process'

import { Register } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'
import { Avatar } from '../../components/avatar.js'
// import { Virtual } from '../../components/virtual.js'
import { RelativeTime } from '../../components/relative-time.js'

async function Message (props) {
  const messageClass = props.mine === true
    ? 'message-wrapper mine'
    : 'message-wrapper'

  return div({ class: messageClass },
    await Avatar(props),
    div({ class: 'author' },
      div({ class: 'nick' }, '@', props.nick, ' - '),
      div({ class: 'timestamp' }, await RelativeTime(props))
    ),
    div({ class: 'message' }, props.body)
  )
}

Message = Register(Message)

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

      if (!elSidebar) elSidebar = document.getElementById('sidebar')
      elSidebar.style.transform = `scale(${Math.min(scale, 1)})`
      elSidebar.style.opacity = opacity
      elSidebar.style.transformOrigin = '20% 70%'
    },
    begin: function (event) {
      if (!elBuffer) elBuffer = document.getElementById('message-buffer')

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
        if (!elSidebarToggle) {
          elSidebarToggle = document.getElementById('sidebar-toggle')
        }

        if (this.currentX < (280 / 2)) {
          elSidebarToggle.setAttribute('open', 'false')
          this.moveTo(0)
        } else {
          elSidebarToggle.setAttribute('open', 'true')
          this.moveTo(280)
        }
      }

      isPanning = false
    },
    complete: function () {
      if (!elBuffer) elBuffer = document.getElementById('message-buffer')
      elBuffer.style.overflow = 'auto'
    }
  })

  this.moveTo = spring.moveTo.bind(spring)
  this.updateTransform = spring.updateTransform.bind(spring)

  //
  // Add a method to create and append a message from outside the component view
  //
  this.insertMessage = async props => {
    const m = await Message(props)
    const messagesBuffer = this.querySelector('.buffer-content')
    messagesBuffer.prepend(m)
  }

  //
  // Handle messages from each network subcluster that was initialized from the database
  //
  for (const [channelId, subcluster] of Object.entries(net.subclusters)) {
    subcluster.on('message', (value, packet) => {
      //
      // There are a few high-level conditions that we should check before accepting data
      //
      if (!packet.verified) return // nope. just gtfo
      if (packet.index !== -1) return // not interested in fragments until they have coalesced

      // messages must be parsable
      try { value = JSON.parse(value) } catch { return }

      // messages must have content
      if (!value || !value.content) return

      // messages must have a type
      if (typeof value.type !== 'string') return

      console.log(value, packet)
      // onMessage(value, packet)
    })
  }

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

  llm.on('data', async data => {
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

      if (data) {
        elCurrentMessage = await Message({ body: data, nick: 'system', mine: false, timestamp: Date.now() })
        const messagesBuffer = this.querySelector('.buffer-content')
        if (elCurrentMessage) messagesBuffer.prepend(elCurrentMessage)
      }
    }

    if (elCurrentMessage) { // just update the last message
      const elMessage = elCurrentMessage.querySelector('.message')
      if (elMessage) elMessage.appendChild(document.createTextNode(data))
    }
  })

  const onSendPress = async () => {
    const elInputMessage = document.getElementById('input-message')
    const data = elInputMessage.innerText.trim()

    if (!data.length) return
    elCurrentMessage = await Message({ body: data, mine: true, nick: 'me', timestamp: Date.now() })

    const messagesBuffer = this.querySelector('.buffer-content')
    if (elCurrentMessage) messagesBuffer.prepend(elCurrentMessage)

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
      elCurrentMessage = null // invalidate the current message
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
      span({ class: 'title' }, '#general')
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

Messages = Register(Messages)
export { Messages }
