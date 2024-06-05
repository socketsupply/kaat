import process from 'socket:process'

import { Register } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'
import { Avatar } from '../../components/avatar.js'
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
  const { net, db, llm, isMobile } = props

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

      this.el.classList.add('moving')

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
      this.el.classList.remove('moving')

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

  //
  // Methods exposed on this element can be accessed by other elements.
  //
  this.moveTo = spring.moveTo.bind(spring)

  this.updateTransform = spring.updateTransform.bind(spring)

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
    // @NOTE We could speak the generated text using the Speech API.
    //
    // const utterance = new SpeechSynthesisUtterance(data)
    // utterance.pitch = 1
    // utterance.rate = 1
    // utterance.volume = 1
    // window.speechSynthesis.speak(utterance)
    //

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

  const publishMessage = async () => {
    const { data: dataPeer } = await db.state.get('peer')
    const { data: dataChannel } = await db.channels.get(dataPeer.subclusterId)

    const subcluster = net.subclusters.get(dataPeer.subclusterId)
    if (!subcluster) return // shouldn't happen but let's check anyway.

    const opts = {
      previousId: dataChannel.lastPacketId // chain this to the last message
    }

    if (content === lastContent) return
    this.lastContent = content

    const message = {
      content,
      type: 'message',
      nick: dataPeer.nick,
      ts: Date.now()
    }

    //
    // @NOTE
    //
    // Emitting messages directly to the subcluster will be
    // distributed, fanned-out to k random peers, prioritizing on
    // the subcluster members. This is eventually consistent data.
    //
    // We will sync with other peers when we connect but with a
    // chat app we want to send messages to anyone else who we
    // are directly connected to.
    //
    await subcluster.emit('message', message, opts)
  }

  const onSendPress = async () => {
    const elInputMessage = document.getElementById('input-message')
    const data = elInputMessage.innerText.trim()

    //
    // 1. Save the user's message to the database for this channel.
    // 2. If necessary, talk to the LLM. But don't broadcast it.
    // 3. Write it to the network with the current subcluster info.
    // 4. Reset the input
    //

    if (!data.length) return
    elCurrentMessage = await Message({ body: data, mine: true, nick: 'me', timestamp: Date.now() })

    const messagesBuffer = this.querySelector('.buffer-content')
    if (elCurrentMessage) messagesBuffer.prepend(elCurrentMessage)

    //
    // tell the LLM to stfu
    //
    if (/^@ai stop$/.test(data.trim())) {
      llm.stop()
      elInputMessage.textContent = ''
      setPlaceholderText()
      return
    }

    // only chat to @ai when it's mentioned.
    if (/^@ai /.test(data.trim())) {
      elCurrentMessage = null // invalidate the current message
      llm.chat(data)
    }

    publishMessage()

    //
    // TODO(@heapwolf): broadcast the message to the subcluster
    //
    elInputMessage.textContent = ''
    setPlaceholderText()
  }

  const setPlaceholderText = () => {
    const elInputMessage = this.querySelector('#input-message')
    const elPlaceholder = this.querySelector('.placeholder-text')

    if (elInputMessage.textContent.trim()) {
      elPlaceholder.classList.add('hide')
      elPlaceholder.classList.remove('show')
    } else {
      elPlaceholder.classList.add('show')
      elPlaceholder.classList.remove('hide')
    }
  }

  //
  // On desktop, enter should send, but shift-enter should create a new line.
  //
  const keydown = (e) => {
    if (isMobile) return // only the button should send on mobile
    if (e.key === 'Enter' && !e.shiftKey) onSendPress()
  }

  const click = (e) => {
    onSendPress()
  }

  const keyup = (e) => {
    setPlaceholderText()
  }

  const { data: dataPeer } = await db.state.get('peer')
  const { data: dataChannel } = await db.channels.get(dataPeer.subclusterId)
  //
  // Passing a function to the render tree will be observed for that element.
  // The deeper the event is placed in the tree, the more specific it will be
  // and the sooner it will fire.
  //
  return [
    header({ class: 'primary draggable' },
      span({ class: 'title' }, '#', dataChannel.label)
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
        span({ class: 'placeholder-text show' }, 'Enter your message...'),

        div({ id: 'input-message', contenteditable: 'plaintext-only', keydown, keyup }),

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
