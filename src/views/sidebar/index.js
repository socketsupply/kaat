import process from 'socket:process'

import { Register } from '../../lib/component.js'

async function Channels (props) {
  return props.data.map(channel => {
    const channelId = Buffer.from(channel.subclusterId).toString('base64')

    return (
      div({ class: 'channel', data: { channelId } },
        span({ class: 'label' },
          span('#', { class: 'channel-symbol' }), channel.label
        ),
        button({ id: 'add-channel' },
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

  const click = (event, match) => {
    if (match('#profile-open')) {
      const elProfile = document.getElementById('profile')
      elProfile.moveTo(vProfilePositionTop)
    }

    if (match('#create-channel-open')) {
      const elDialog = document.getElementById('create-channel')
      elDialog.open()
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
    )
  ]
}

Sidebar = Register(Sidebar)
export { Sidebar }
