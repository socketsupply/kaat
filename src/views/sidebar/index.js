import process from 'socket:process'

import { Register } from '../../lib/component.js'

async function Channels (props) {
  //
  // When a channel is clicked, activate or manage it.
  //
  const click = async (event, match) => {
    const el = match('[data-event]')
    if (!el) return

    switch (el.dataset.event) {
      case 'manage-channel': {

        const channel = props.data.find(ch => ch.subclusterId === el.dataset.value)
        if (!channel) return

        const elDialog = document.getElementById('manage-channel')

        elDialog.render({
          slots: {
            channelName: channel.label,
            key: channel.key
          }
        })

        const res = await elDialog.open()
      }
    }
  }

  return props.data.map(channel => {
    return (
      div(
        { class: 'channel', data: { value: channel.subclusterId }, click },
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

  this.on('connected', e => {
    // ...this component is ready
  })

  const click = async (event, match) => {
    if (match('#profile-open')) {
      const elProfile = document.getElementById('profile')
      elProfile.moveTo(vProfilePositionTop)
    }

    if (match('#create-channel-open')) {
      const elDialog = document.getElementById('create-channel')
      const res = await elDialog.open()
      //
      // TODO create a channel
      //
    }
  }

  const { data: dataChannels } = await db.channels.readAll()

  return [
    header({ class: 'primary draggable', click },
      div({ class: 'content' },
        button({ id: 'create-channel-open' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#plus-icon' })
          )
        ),
        button({ id: 'profile-open' },
          svg({ class: 'app-icon' },
            use({ 'xlink:href': '#profile-icon' })
          )
        )
      )
    ),
    div({ class: 'content' },
      await Channels({ id: 'channels', data: [...dataChannels.values()] })
    ),

    Modal(
      {
        id: 'create-channel',
        header: 'Create Channel',
        style: { width: '420px' },
        buttons: [{ value: 'ok', label: 'OK' }]
      },
      Text({
        errorMessage: 'Nope',
        label: 'Channel Name',
        pattern: '[a-zA-Z0-9 ]+',
        placeholder: 'Space Camp'
      })
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
