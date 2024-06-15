import process from 'socket:process'
import path from 'socket:path'
import { sha256 } from 'socket:network'
import { LLM } from 'socket:ai'

import { Register } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'
import { Avatar } from '../../components/avatar.js'
import { RelativeTime } from '../../components/relative-time.js'

//
// Message and VirtualMessages render and rerender unencypted messages.
//
async function Message (props = {}) {
  this.id = props.messageId
  if (props.mine) this.classList.add('mine')

  return [
    await Avatar(props),
    div({ class: 'message' },
      div({ class: 'author' },
        div({ class: 'nick' }, '@', props.nick, ' - '),
        div({ class: 'timestamp' }, await RelativeTime(props))
      ),
      div({ class: 'content' }, props.content)
    )
  ]
}

Message = Register(Message)

async function VirtualMessages (props) {
  const messages = props.rows.filter(Boolean)
  const rows = await Promise.all(messages.map(Message))

  return div({ id: 'message-buffer' },
    div({ class: 'buffer-content' }, rows)
  )
}

VirtualMessages = Register(VirtualMessages)

async function Messages (props) {
  const { net, db, isMobile } = props

  //
  // Cache elements that we will touch frequently with the interaction/animation.
  //
  let elBuffer
  let elSidebar
  let elSidebarToggle

  let isPanning = false
  let lastContent = null

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

      if (pos > 10) {
        document.body.classList.add('moving')
      } else {
        document.body.classList.remove('moving')
      }
    },
    begin: function (event) {
      if (!elBuffer) elBuffer = document.getElementById('message-buffer')
      if (elBuffer) elBuffer.style.overflow = 'auto'

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
        if (el.closest('message') || el.classList.contains('message')) return
      }

      if (isLinear && isSignificant) {
        isPanning = true
        if (elBuffer) elBuffer.style.overflow = 'hidden'
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
      if (elBuffer) elBuffer.style.overflow = 'auto'
    }
  })

  //
  // Methods exposed on this element can be accessed by other elements.
  //
  this.moveTo = spring.moveTo.bind(spring)

  this.updateTransform = spring.updateTransform.bind(spring)

  const prepareMessageForReading = async message => {
    //
    // First, look up any claims that have been made about the owner of the packet
    // If there is a claim, we can use the nick from it to indicate if it's verified.
    //
    const pk = message.publicKey

    const { data: dataClaim } = await db.claims.get(pk)
    const opened = await net.socket.open(Buffer.from(message.message), message.subclusterId)

    const props = {
      messageId: message.messageId,
      timestamp: Date.now()
    }

    if (!opened) {
      props.content = `<Encrypted>`
    } else {
      try {
        const json = JSON.parse(Buffer.from(opened).toString())

        props.content = json.content
        props.timestamp = json.ts
        props.nick = dataClaim?.trusted ? dataClaim.nick : json.nick
        props.trusted = dataClaim?.trusted === true
      } catch (err) {
        console.error(err)
        return
      }
    }

    return props
  }

  const packetToMessage = (packet) => {
    //
    // Packets that we create wont be fragmented, so we dont need to
    // think about splitting or reconciling packet fragments.
    //
    // Store the packet encrypted and only decrypt it when the message
    // is actively being displayed to the screen.
    //
    return {
      messageId: Buffer.from(packet.packetId).toString('hex'),
      subclusterId: Buffer.from(packet.subclusterId).toString('base64'),
      message: packet.message,
      publicKey: Buffer.from(packet.usr2).toString('base64')
    }
  }

  const { data: dataPeer } = await db.state.get('peer')
  const { data: dataChannel } = await db.channels.get(dataPeer.channelId)
 
  const elChannels = document.querySelector('channels')

  net.subclusters[dataPeer.channelId].on('message', async (value, packet) => {
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

    // let's save this one, we want it.
    const message = packetToMessage(packet)

    await db[dataPeer.channelId].put([value.ts, message.messageId], message)

    const child = await Message(await prepareMessageForReading(message))
    let parent = channels.state[dataPeer.channelId]

    if (!parent) { // no prior channel switching, fall back
      parent = document.querySelector('virtual-messages')
    }

    // TODO(@heapwolf): if the channel is not selected, mark the channel as having new messages, re-render `#channels`.

    const messageBuffer = parent.querySelector('.buffer-content')

    // should probably insert rather than append
    messageBuffer.prepend(child)
  })

  //
  // Handle output from the LLM and input from the user.
  //
  let elCurrentMessage = null
  let currentMessageStream = ''

  //
  // Create an LLM that can partcipate in the chat.
  //
  const llm = new LLM(dataChannel)

  llm.on('end', async () => {
    const { data: dataPeer } = await db.state.get('peer')

    const ts = Date.now()

    const data = JSON.stringify({
      content: currentMessageStream,
      type: 'message',
      nick: 'system',
      ts
    })

    const message = {
      messageId: (await sha256(currentMessageStream)).toString('hex'),
      message: (await net.socket.seal(data, dataPeer.subclusterId)),
      publicKey: Buffer.from(dataPeer.signingKeys.publicKey).toString('base64'),
      subclusterId: dataPeer.subclusterId
    }

    elCurrentMessage = null
    currentMessageStream = ''
    llm.stop()

    await db[dataPeer.channelId].put([ts, message.messageId], message)
  })

  llm.on('log', data => {
    console.log(data)
  })

  llm.on('data', async data => {
    currentMessageStream += data

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
        elCurrentMessage = await Message({ content: data, nick: 'system', mine: false, timestamp: Date.now() })
        const parent = document.querySelector('virtual-messages .buffer-content')
        if (elCurrentMessage) parent.prepend(elCurrentMessage)
      }
    }

    if (elCurrentMessage) { // just update the last message
      const elMessage = elCurrentMessage.querySelector('.content')
      if (elMessage) elMessage.appendChild(document.createTextNode(data))
    }
  })

  const publish = async (content) => {
    const { data: dataPeer } = await db.state.get('peer')
    const { data: dataChannel } = await db.channels.get(dataPeer.channelId)

    const subcluster = net.subclusters[dataPeer.channelId]
    if (!subcluster) return // shouldn't happen but let's check anyway.

    const opts = {
      previousId: dataChannel.lastPacketId // chain this to the last message
    }

    if (content === lastContent) return
    lastContent = content

    const ts = Date.now()

    const message = {
      content,
      nick: dataPeer.nick,
      ts,
      type: 'message'
    }

    //
    // @NOTE
    //
    // Not online? Not a problem. All messages go though the internal cache.
    //
    // Emitting messages directly to the subcluster will be eventually be sent
    // and eventually distributed, fanned-out to k random peers, prioritizing
    // on the subcluster members.
    //
    await subcluster.emit('message', message, opts)
  }

  const onSendPress = async () => {
    const elInputMessage = document.getElementById('input-message')
    let data = elInputMessage.innerText.trim()

    //
    // 1. Save the user's message to the database for this channel.
    // 2. If necessary, talk to the LLM. But don't broadcast it.
    // 3. Write it to the network with the current subcluster info.
    // 4. Reset the input
    //

    if (!data.length) return
    // elCurrentMessage = await Message({ content: data, mine: true, nick: 'me', timestamp: Date.now() })

    // const messagesBuffer = document.querySelector('virtual-messages .buffer-content')
    // if (elCurrentMessage) messagesBuffer.prepend(elCurrentMessage)

    //
    // tell the LLM to stfu
    //
    if (/^@ai stop$/.test(data)) {
      llm.stop()
      elInputMessage.innerHTML = ''
      setPlaceholderText()
      return
    }

    // only chat to @ai when it's mentioned.
    if (/^@ai /.test(data)) {
      elCurrentMessage = null // invalidate the current message
      llm.chat(data.replace(/^@ai\s+/, ''))
    }

    //
    // TODO(@heapwolf): broadcast the message to the subcluster
    //
    elInputMessage.innerHTML = ''
    setPlaceholderText()

    //
    // Try to send it!
    //
    publish(data)
  }

  const setPlaceholderText = () => {
    const elInputMessage = this.querySelector('#input-message')
    const elPlaceholder = this.querySelector('.placeholder-text')

    if (elInputMessage.textContent.length) {
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
  const onkeydown = (e) => {
    setPlaceholderText()
    if (isMobile) return // only the button should send on mobile
    if (e.key === 'Enter' && !e.shiftKey) onSendPress()
  }

  const onclick = (e) => {
    onSendPress()
  }

  const onkeyup = (e) => {
    setPlaceholderText()
  }

  //
  // The fist time this component renders we can get the data for the current
  // channel from the datatabase and pass that to the virtual list component.
  //
  const { data: dataMessages } = await db[dataPeer.channelId].readAll({ limit: 5000, reverse: true })

  //
  // Unencrypt the messages
  //
  let rows = []

  if (dataMessages) {
    const messages = [...dataMessages.values()].map(message => {
      return prepareMessageForReading(message)
    })

    rows = await Promise.all(messages)
  }

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
      // The thing that actually handles rendering the messages
      //
      await VirtualMessages({ data: { id: dataPeer.channelId }, rows }),

      //
      // The input area
      //
      div({ id: 'input' },
        span({ class: 'placeholder-text show' }, 'Enter your message...'),

        div({ id: 'input-message', contenteditable: 'plaintext-only', onkeydown, onkeyup }),

        button({ id: 'send-message', onclick },
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
