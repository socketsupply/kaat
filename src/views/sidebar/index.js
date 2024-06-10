import process from 'socket:process'

import { Register } from '../../lib/component.js'

async function Channels (props) {
  const {
    data,
    db
  } = props

  const { data: dataPeer } = await db.state.get('peer')

  this.state = {}

  //
  // When a channel is clicked, activate or manage it.
  //
  const onclick = async (event, match) => {
    const el = match('[data-event]')
    if (!el) return

    switch (el.dataset.event) {
      case 'manage-channel': {

        const channel = data.find(ch => ch.subclusterId === el.dataset.value)
        if (!channel) return

        const elDialog = document.getElementById('manage-channel')

        elDialog.render({
          slots: {
            channelName: channel.label,
            key: channel.key
          }
        })

        const res = await elDialog.open()
        break
      }

      case 'activate-channel': {
        // Find the new channel, make sure its valid
        const channel = data.find(ch => ch.subclusterId === el.dataset.value)
        if (!channel) return

        const { data: dataPeer } = await db.state.get('peer')
        dataPeer.subclusterId = channel.subclusterId
        await db.state.put('peer', dataPeer)

        // Remove the active state from any other item in the list
        ;[...this.querySelectorAll('.channel')].forEach(el => {
          el.removeAttribute('data-active')
        })

        // Add the active state to the new item
        el.setAttribute('data-active', 'true')

        // Change the messages buffer area to show the new label
        const elMessagesHeader = document.querySelector('#messages header .title')
        elMessagesHeader.textContent = `#${channel.label}`

        // get the current node
        const attachedNode = document.querySelector('virtual-messages')

        if (attachedNode) {
          // retain the node
          if (!this.state[attachedNode.dataset.id]) {
            this.state[attachedNode.dataset.id] = attachedNode
          }
        }

        // get the detatched node and reattach it
        const detatchedNode = this.state[dataPeer.subclusterId]

        if (detatchedNode) {
          // swap the detatched node with the currently attached one
          attachedNode.parentElement.replaceChild(detatchedNode, attachedNode)
        } else {
          // there is no node to swap, so create a new one by calling render.
          // this will set up all the events and everything for the new channel.
          const messagesRoot = document.querySelector('#messages')
          messagesRoot.render()
        }
      }
    }
  }

  return data.map(channel => {
    return (
      div(
        {
          class: 'channel',
          data: {
            event: 'activate-channel',
            value: channel.subclusterId,
            active: channel.subclusterId === dataPeer?.subclusterId
          },
          onclick
        },
        span({ class: 'label' },
          span('#', { class: 'channel-symbol' }), channel.label
        ),
        button(
          { data: { event: 'manage-channel', value: channel.subclusterId } },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#config-icon' })
          )
        )
      )
    )
  })
}

Channels = Register(Channels)

async function Sidebar (props) {
  const {
    isMobile,
    db
  } = props

  const vProfilePositionTop = isMobile ? 90 : 48
  const vProfileTransformOrigin = isMobile ? 100 : 80
  const vProfileTransformMag = isMobile ? 0.5 : 0.08

  const onclick = async (event, match) => {
    const el = match('[data-event]')

    if (el?.dataset.event === 'profile-open') {
      const elProfile = document.getElementById('profile')
      elProfile.moveTo(vProfilePositionTop)
    }

    if (el?.dataset.event === 'create-channel-open') {
      const elDialog = document.getElementById('create-channel')
      const res = await elDialog.open()
      //
      // TODO create a channel
      //
    }

    if (el?.dataset.event === 'copy-icon') {
      e.preventDefault()

      const el = match('[data-event="copy-icon"]')
      const text = el.closest('text')
      await navigator.clipboard.writeText(text.value)
    }
  }

  const { data: dataChannels } = await db.channels.readAll()

  return [
    header({ class: 'primary draggable', onclick },
      div({ class: 'content' },
        button({ id: 'create-channel-open', data: { event: 'create-channel-open' } },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#plus-icon' })
          )
        ),
        button({ id: 'profile-open', data: { event: 'profile-open' } },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#profile-icon' })
          )
        )
      )
    ),
    div({ class: 'content' },
      await Channels({ id: 'channels', data: [...dataChannels.values()], db })
    ),

    Modal(
      {
        id: 'create-channel',
        header: 'Create Channel',
        style: { width: '420px' },
        buttons: [{ value: 'ok', label: 'OK' }]
      },
      div({ class: 'grid' },
        Text({
          errorMessage: 'Nope',
          label: 'Channel Name',
          pattern: '[a-zA-Z0-9 ]+',
          placeholder: 'Space Camp'
        }),
        Text({
          errorMessage: 'Nope',
          label: 'Secret Key',
          type: 'password',
          icon: 'copy-icon',
          placeholder: 'Channel Key'
        })
      )
    ),

    Modal(
      {
        id: 'manage-channel',
        header: 'Manage Channel',
        style: { width: '420px' },
        buttons: [
          { value: 'ok', label: 'OK' },
          { value: 'delete', label: 'Delete' }
        ]
      },
      div({ class: 'grid' },
        Text({
          errorMessage: 'Nope',
          label: 'Channel Name',
          data: { slot: 'channelName' },
          pattern: '[a-zA-Z0-9 ]+',
          placeholder: 'Space Camp'
        }),
        Text({
          errorMessage: 'Nope',
          label: 'Secret Key',
          data: { slot: 'key' },
          type: 'password',
          icon: 'copy-icon',
          placeholder: 'Channel Key'
        })
      )
    )
  ]
}

Sidebar = Register(Sidebar)
export { Sidebar }
