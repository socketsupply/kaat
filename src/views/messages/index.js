import path from 'socket:path'
import * as mime from 'socket:mime'
import { sha256 } from 'socket:network'
import os from 'socket:os'
// import { LLM } from 'socket:ai'

import { Compressor } from '../../lib/compressor.js'
import { component } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'

import Avatar from '../../components/avatar.js'
import Text from '../../components/text.js'
import RelativeTime from '../../components/relative-time.js'

let signal // an interval that advertises we are online

//
// Message and VirtualMessages render and rerender unencypted messages.
//
async function Message (props = {}) {
  if (!props.messageId) return span()

  this.id = props.messageId
  if (props.mine) this.classList.add('mine')

  let image

  if (props.isImage) {
    image = document.createElement('img')
    image.dataset.event = 'preview'
    const durl = new Blob([props.content], { type: props.mime })
    const vurl = URL.createObjectURL(durl)
    image.src = vurl
    image.onload = () => window.URL.revokeObjectURL(vurl)
  }

  this.setAttribute('timestamp', props.timestamp)

  return [
    await Avatar(props),
    div({ class: 'message' },
      div({ class: 'author' },
        div({ class: 'nick' }, '@', props.nick, ' - '),
        div({ class: 'timestamp' }, await RelativeTime(props))
      ),
      div({ class: 'content' }, image || props.content)
    )
  ]
}

Messages.Message = component(Message)

async function VirtualMessages (props) {
  const messages = props.rows.filter(Boolean)
  let rows = await Promise.all(messages.map(Messages.Message))

  const onclick = (event, match) => {
    const el = match('[data-event]')

    if (el?.dataset.event === 'manage-channel') {
      const elChannels = document.querySelector('channels')
      elChannels.manageChannel(el.dataset.value)
    }

    if (el?.dataset.event === 'preview') {
      const elPreview = document.querySelector('preview')
      elPreview.value = el
      elPreview.open()
    }
  }

  let rowFetchLock = null

  const fetchMoreRows = () => {
    if (rowFetchLock) return

    rowFetchLock = setTimeout(() => {
      rowFetchLock = null
    }, 1024)

    this.dispatchEvent(new CustomEvent('scroll', { bubbles: true }))
  }

  const onscroll = (event, match) => {
    const container = this.firstElementChild
    const ceil = container.scrollHeight - container.clientHeight
    const top = 100 + (container.scrollTop / ceil) * 100
    if (top < 20) fetchMoreRows()
  }

  if (rows.length === 0) {
    const { data: dataPeer } = await props.db.state.get('peer')
    const { data: dataChannel } = await props.db.channels.get(dataPeer.channelId)

    rows = div({ class: 'empty-state' },
      div({ onclick },
        'Invite friends to this channel by sharing this access token.',
        br(),
        br(),
        Text({
          errorMessage: 'Nope',
          label: 'Access Token',
          data: { slot: 'accessToken' },
          type: 'password',
          icon: 'copy-icon',
          iconEvent: 'copy',
          readOnly: 'true',
          value: dataChannel.accessToken,
          placeholder: 'fa00 d486 2e27 4eec'
        }),
        br(),
        br(),
        'Accept an invite by clicking ',
        a({ href: '#', data: { event: 'create-channel-open' } }, 'here'),
        ', use the access token that was shared with you.'
      )
    )
  }

  return div({ id: 'message-buffer', onclick, onscroll },
    div({ class: 'buffer-content' }, rows)
  )
}

Messages.VirtualMessages = component(VirtualMessages)

const fitMessages = () => {
  const remainingWidth = (100 - (
    sidebarWidth * progress / window.innerWidth * 100
  )).toFixed(2)
  this.el.style.width = `calc(${remainingWidth}vw)`
}

let resizeEvent = () => {}

window.addEventListener('resize', e => {
  resizeEvent()
})

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
  const sidebarWidth = 280
  let lastKeyRead = null

  //
  // Enable some fun interactions on the messages element
  //

  const spring = new Spring(this, {
    axis: 'X',
    absolute: true,
    position: function (pos) {
      const progress = pos / sidebarWidth
      const scale = 0.95 + 0.05 * progress
      const opacity = 0.0 + 1 * progress

      if (!isMobile) {
        resizeEvent = () => {
          const remainingWidth = (100 - (
            sidebarWidth * progress / window.innerWidth * 100
          )).toFixed(2)
          this.el.style.width = `calc(${remainingWidth}vw)`
        }
        resizeEvent()
      }

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
        const dx = this.clientX - this.startX
        this.updatePosition('X', Math.max(0, Math.min(dx, 280)))
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
    const { data: dataClaim } = await db.claims.get(message.publicKey)
    const opened = await net.socket.open(Buffer.from(message.message), message.subclusterId)

    const props = {
      ...message,
      timestamp: message.ts,
      nick: dataClaim?.nick ?? message.nick
    }

    if (message.isImage) {
      props.content = opened
      delete props.message
      props.timestamp = message.ts
    } else {
      try {
        const json = JSON.parse(Buffer.from(opened).toString())
        props.content = json.content
      } catch (err) {
        console.warn(err)
        return
      }

      props.trusted = dataClaim?.trusted === true
      props.ext = message.ext
      props.mime = message.mime
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
    const ext = path.extname(packet.meta.name).slice(1)
    const mime = packet.meta.mime || 'application/octet-stream'

    return {
      messageId: Buffer.from(packet.packetId).toString('hex'),
      subclusterId: Buffer.from(packet.subclusterId).toString('base64'),
      message: packet.message,
      publicKey: Buffer.from(packet.usr2).toString('base64'),
      isImage: (mime && /png|jpeg|jpg|gif/.test(ext)) || mime.includes('image'),
      ext,
      mime
    }
  }

  const { data: dataPeer } = await db.state.get('peer')
  const { data: dataChannel } = await db.channels.get(dataPeer.channelId)

  const elChannels = document.querySelector('channels')

  const insertNode = (parent, timestamp, child) => {
    const messages = Array.from(parent.children)

    let inserted = false

    for (let i = 0; i < messages.length; i++) {
      const currentTimestamp = parseInt(messages[i].getAttribute('timestamp'), 10)

      if (currentTimestamp <= timestamp) {
        parent.insertBefore(child, messages[i])
        inserted = true
        break
      }
    }

    if (!inserted) {
      parent.prepend(child)
    }
  }

  const onscroll = async () => {
    const { data: dataPeer } = await props.db.state.get('peer')
    const { data: dataMessages } = await db[dataPeer.channelId].readAll({
      lte: lastKeyRead,
      limit: 32,
      reverse: true
    })

    if (dataMessages) {
      const keys = [...dataMessages.keys()]
      const values = [...dataMessages.values()]

      lastKeyRead = keys.at(-1)

      const messages = await Promise.all(values.map(message => {
        return prepareMessageForReading(message)
      }))

      let parent = elChannels.state[dataPeer.channelId]

      if (!parent) { // no prior channel switching, fall back
        parent = document.querySelector('virtual-messages')
      }

      const messageBuffer = parent.querySelector('.buffer-content')
      if (!parent || !messageBuffer) return

      for (const message of messages) {
        const elMessage = await Messages.Message(message)
        requestAnimationFrame(() => messageBuffer.appendChild(elMessage))
      }
    }
  }

  const onMessage = async (value, packet) => {
    //
    // There are a few high-level conditions that we should check before accepting data
    //
    if (!packet.verified) return // nope. just gtfo
    if (packet.index !== -1) return // not interested in fragments until they have coalesced

    const isFile = packet.meta.mime

    if (!isFile) {
      // text messages must be parsable
      try { value = JSON.parse(value) } catch { return }

      // text messages must have content
      if (!value || !value.content) return

      // messages must have a type
      if (typeof value.type !== 'string') return
    }

    // let's save this one, we want it.
    const message = packetToMessage(packet)
    message.ts = value.ts || packet.meta.ts // use the unencrypted timestamp
    message.nick = value.nick

    const { data: hasMessage } = await db.indexes.has(message.messageId)
    if (hasMessage) return

    await db[dataPeer.channelId].put([message.ts, message.messageId], message)
    await db.indexes.put(message.messageId, message.ts)

    const child = await Messages.Message(await prepareMessageForReading(message))
    let parent = elChannels.state[dataPeer.channelId]

    if (!parent) { // no prior channel switching, fall back
      parent = document.querySelector('virtual-messages')
    }

    // TODO(@heapwolf): check if the channel is not selected, mark the channel as having new messages, re-render `#channels`.

    const messageBuffer = parent.querySelector('.buffer-content')

    if (messageBuffer) {
      insertNode(messageBuffer, message.ts, child)
      clearEmptyState()
    }
  }

  const onClaim = async (value, packet) => {
    if (!packet.verified) return // nope. just gtfo
    if (packet.index !== -1) return // not interested in fragments until they have coalesced
    if (!packet.usr2) return

    const b64pk = Buffer.from(packet.usr2).toString('base64')

    const { dataClaim } = await db.claims.get(b64pk)
    if (dataClaim && dataClaim.local) return // don't accept any claim with our own pk

    try {
      value = JSON.parse(Buffer.from(value))
    } catch (err) {
      console.log(err)
    }

    db.claims.put(b64pk, {
      ...value,
      trusted: false
    })
  }

  net.subclusters[dataPeer.channelId].on('message', onMessage)
  net.subclusters[dataPeer.channelId].on('claim', onClaim)

  const elPeerList = document.getElementById('peer-list')

  net.socket.on('#disconnection', () => elPeerList.render())
  net.socket.on('#connection', () => elPeerList.render())

  clearInterval(signal)

  signal = setInterval(async () => {
    const publicKey = dataPeer.signingKeys.publicKey
    const b64pk = Buffer.from(publicKey).toString('base64')
    const { data: dataClaim } = await db.claims.get(b64pk)

    const opts = {
      ...dataPeer.signingKeys,
      ttl: 3e4 // opt-into this being a short lived message
    }

    const info = await net.socket.getInfo()

    //
    // Other peers who can decrypt messages for this subcluster can examine
    // this packet and decide if they want to trust you or block you.
    //
    const claim = {
      ctime: Date.now(),
      clock: info.clock,
      peerId: info.peerId,
      status: dataClaim.status,
      nick: dataClaim.nick
    }

    const subcluster = net.subclusters[dataPeer.channelId]

    if (subcluster) await subcluster.emit('claim', claim, opts)
  }, 6e4)

  //
  // An example of how you might create an LLM that can partcipate in the chat.
  //
  /* const llm = new LLM(dataChannel)

  //
  // Handle output from the LLM and input from the user.
  //
  let elCurrentMessage = null
  let currentMessageStream = ''

  llm.on('end', async () => {
    const { data: dataPeer } = await db.state.get('peer')

    const ts = Date.now()

    const data = JSON.stringify({
      content: currentMessageStream,
      type: 'message',
      nick: 'ai',
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
        elCurrentMessage = await Message({ messageId: 'X', content: data, nick: 'system', mine: false, timestamp: Date.now() })
        const parent = document.querySelector('virtual-messages .buffer-content')
        if (elCurrentMessage) parent.prepend(elCurrentMessage)
      }
    }

    if (elCurrentMessage) { // just update the last message
      const elMessage = elCurrentMessage.querySelector('.content')
      if (elMessage) elMessage.appendChild(document.createTextNode(data))
    }
  }) */

  const clearEmptyState = () => {
    const emptyState = document.querySelector('messages .empty-state')
    if (emptyState) emptyState.parentNode.removeChild(emptyState)
  }

  const publishText = async (content) => {
    const { data: dataPeer } = await db.state.get('peer')
    const publicKey = dataPeer.signingKeys.publicKey
    const b64pk = Buffer.from(publicKey).toString('base64')
    const { data: dataClaim } = await db.claims.get(b64pk)
    const { data: dataChannel } = await db.channels.get(dataPeer.channelId)

    const subcluster = net.subclusters[dataPeer.channelId]
    if (!subcluster) return // shouldn't happen but let's check anyway.

    const opts = {
      previousId: dataChannel.lastPacketId // TODO(@heapwolf): actually assign this on recv
    }

    if (content === lastContent) return
    lastContent = content

    const ts = Date.now()

    const message = {
      content,
      nick: dataClaim.nick,
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

    clearEmptyState()
  }

  const publishImage = async (buf, fileInfo) => {
    const opts = {
      previousId: null,
      meta: fileInfo
    }

    let message

    try {
      const sizeBeforeCompression = buf.byteLength

      const compress = new Compressor({ type: fileInfo.type })
      const { bytes } = await compress.from(buf)
      const sizeAfterCompression = bytes.byteLength

      const sizeReduction = sizeBeforeCompression - sizeAfterCompression
      const reductionPercentage = (sizeReduction / sizeBeforeCompression) * 100

      console.log(`Image reduced by ${sizeReduction} bytes (${reductionPercentage.toFixed(2)}%).`)

      const Mb = bytes / (1024 * 1024)

      if (Mb > 1) { // TODO(@heapwolf): could make this a limit in the channel settings.
        // TODO(@heapwolf): put this into the UI, maybe even replace the image with it.
        console.log(`Image too big (${Mb}Mb), you\'ll spam the network and get rate limited.`)
        return
      }

      message = bytes

      opts.meta.mime = fileInfo.type
      opts.meta.hash = await sha256(bytes)
      opts.meta.ts = Date.now()
      opts.meta.name = fileInfo.pathname
    } catch (err) {
      console.warn(err.message)
      return
    }

    const { data: dataPeer } = await db.state.get('peer')
    const subcluster = net.subclusters[dataPeer.channelId]
    if (!subcluster) return

    await subcluster.emit('message', message, opts)
  }

  const publishImages = async () => {
    const elInputMessage = document.getElementById('input-message')
    const images = [...elInputMessage.querySelectorAll('img[src]')]

    //
    // Handle any pasted images by iterating over the image nodes in the input
    //
    if (images.length) {
      // TODO(@heapwolf) get last messageId to use as previousId using readAll({ reverse: true, limit: 1 })

      for (const image of images) {
        const response = await fetch(image.src)
        const blob = await response.blob()
        let type = 'image/generic'

        if (!blob) {
          console.warn('Something went wrong reading this image')
          return
        }

        if (blob.type && blob.type !== 'text/xml') {
          type = blob.type
        }

        const pathname = response.url.split(/\/|\\/).pop()
        const buf = await blob.arrayBuffer()

        await publishImage(buf, { type, pathname })
        clearEmptyState()
        image.parentNode.removeChild(image)
      }
    }
  }

  const onSendFile = async () => {
    const pickerOpts = {
      types: [
        {
          description: 'Select an Image',
          accept: {
            'image/*': ['.png', '.gif', '.jpeg', '.jpg']
          }
        }
      ],
      excludeAcceptAllOption: true,
      multiple: false
    }

    const [fileHandle] = await window.showOpenFilePicker(pickerOpts)
    if (!fileHandle) return

    const file = await fileHandle.getFile()
    const pathname = fileHandle.name
    const type = await mime.lookup(pathname)
    const buf = await file.arrayBuffer()
    publishImage(buf, { type, pathname })
  }

  const onSendPress = async () => {
    const elInputMessage = document.getElementById('input-message')

    // TODO(@heapwolf): should be fast but provide some ui feedback anyway, spinner maybe.
    await publishImages()

    const data = elInputMessage.innerText.trim()

    if (!data.length) {
      elInputMessage.innerHTML = ''
      return
    }

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
    if (os.platform() === 'android') {
      // XXX(@jwerle): not sure about iOS
      elInputMessage.focus()
    }

    //
    // Try to send it!
    //
    await publishText(data)
  }

  const hidePlaceholderText = () => {
    const elPlaceholder = this.querySelector('.placeholder-text')
    elPlaceholder.classList.add('hide')
    elPlaceholder.classList.remove('show')
  }

  const setPlaceholderText = () => {
    const elInputMessage = this.querySelector('#input-message')
    const elPlaceholder = this.querySelector('.placeholder-text')
    const hasImage = elInputMessage.querySelector('img')
    const isEditing = elInputMessage.offsetHeight > 32
    const hasText = elInputMessage.textContent.length

    if (hasImage || isEditing || hasText) {
      this.classList.add('dirty')
      this.classList.remove('clean')
      elPlaceholder.classList.add('hide')
      elPlaceholder.classList.remove('show')
    } else {
      this.classList.add('clean')
      this.classList.remove('dirty')
      elPlaceholder.classList.add('show')
      elPlaceholder.classList.remove('hide')
    }
  }

  //
  // On desktop, enter should send, but shift-enter should create a new line.
  //
  let keydownDebouncer = null

  const onkeydown = e => {
    if (isMobile) return // only the button should send on mobile
    if (e.key === 'Enter' && !e.shiftKey) {
      clearTimeout(keydownDebouncer)
      keydownDebouncer = setTimeout(() => onSendPress(), 32)
    }
    setTimeout(() => setPlaceholderText(), 2)
  }

  const onclick = (event, match, el) => {
    if (el = match('#send-message')) {
      onSendPress()
    }

    if (el = match('#send-file')) {
      onSendFile()
    }

    if (el = match('#open-streams')) {
      const elModalAudio = document.getElementById('audio-streams')

      if (elModalAudio.classList.contains('open')) {
        elModalAudio.close()
      } else {
        elModalAudio.open()
      }
    }

    if (el = match('img')) {
      const elPreview = document.querySelector('preview')
      elPreview.value = el.src
      elPreview.open()
    }
  }

  const onkeyup = () => setTimeout(() => setPlaceholderText(), 2)
  const onpaste = () => hidePlaceholderText()

  //
  // The fist time this component renders we can get the data for the current
  // channel from the datatabase and pass that to the virtual list component.
  //
  const { data: dataMessages } = await db[dataPeer.channelId].readAll({
    limit: 32, // TODO(@heapwolf) set up demand-paging
    reverse: true
  })

  //
  // Unencrypt the messages
  //
  let rows = []

  if (dataMessages) {
    const keys = [...dataMessages.keys()]
    const values = [...dataMessages.values()]

    lastKeyRead = keys.slice(-1)[0]

    const messages = values.map(message => {
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
    header({ class: 'primary draggable', onclick },
      span({ class: 'title' }, '#', dataChannel.label),
      button({ id: 'profile-open', data: { event: 'profile-open' } },
        svg({ class: 'app-icon' },
          use({ 'xlink:href': '#settings-icon' })
        )
      )
    ),

    div({ class: 'content', onscroll },
      //
      // The thing that actually handles rendering the messages
      //
      await Messages.VirtualMessages({ data: { id: dataPeer.channelId }, db, rows }),

      //
      // The input area
      //
      div({ id: 'input', onclick },
        span({ class: 'placeholder-text show' }, 'Enter your message...'),

        div({ id: 'input-message', contenteditable: 'true', onkeydown, onkeyup, onpaste }),

        button({ id: 'send-file' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#plus-icon' })
          )
        ),

        button({ id: 'open-streams' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#talk-icon' })
          )
        ),

        button({ id: 'send-message' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#send-icon' })
          )
        )
      )
    )
  ]
}

export default component(Messages)
