import process from 'socket:process'

import { Register } from '../../lib/component.js'
import { Spring } from '../../lib/spring.js'

function PeerList (props) {
  const peers = []

  if (!props.net?.subclusters) return b()

  for (const [scid, subcluster] of Object.entries(props.net.subclusters)) {
    for (const peer of [...subcluster.peers.values()]) {
      peers.push(
        tr(
          td([peer.peerId.slice(0, 6), peer.peerId.slice(-2)].join('..')),
          td([peer.address, peer.port].join(':')),
          td([scid.slice(0, 6), scid.slice(-2)].join('..'))
        )
      )
    }
  }

  return table(
    thead(
      tr(
        th('Id'),
        th('Address:Port'),
        th('Subcluster')
      )
    ),
    tbody(
      ...peers
    )
  )
}

PeerList = Register(PeerList)

function PeerInfo (props) {
  let shortPeerId = 'Working...'
  let combinedAddress = 'Working...'
  let natType = 'Working...'

  if (props.peerId) {
    shortPeerId = props.peerId?.slice(0, 6) + '..' + props.peerId?.slice(-2)
    combinedAddress = `${props?.address}:${props?.port}`
    natType = props.natName
  }

  return (
    table(
      thead(
        tr(
          th('Property'),
          th('Value')
        )
      ),
      tbody(
        tr(
          td('Id'),
          td(shortPeerId)
        ),
        tr(
          td('Address:Port'),
          td(combinedAddress)
        ),
        tr(
          td('Nat Type'),
          td(natType)
        )
      )
    )
  )
}

PeerInfo = Register(PeerInfo)

function PeerMetrics (props) {
  props.i ??= []
  props.o ??= []

  return (
    table(
      thead(
        tr(
          th('Packet'),
          th('In:Out')
        )
      ),
      tbody(
        tr(
          td('Opener'),
          td([props.i[0], props.o[0]].join(':'))
        ),
        tr(
          td('Ping'),
          td([props.i[1], props.o[1]].join(':'))
        ),
        tr(
          td('Pong'),
          td([props.i[2], props.o[2]].join(':'))
        ),
        tr(
          td('Intro'),
          td([props.i[3], props.o[3]].join(':'))
        ),
        tr(
          td('Join'),
          td([props.i[4], props.o[4]].join(':'))
        ),
        tr(
          td('Publish'),
          td([props.i[5], props.o[5]].join(':'))
        ),
        tr(
          td('Stream'),
          td([props.i[6], props.o[6]].join(':'))
        ),
        tr(
          td('Sync'),
          td([props.i[7], props.o[7]].join(':'))
        ),
        tr(
          td('Query'),
          td([props.i[8], props.o[8]].join(':'))
        ),
        tr(
          td('Dropped'),
          td([props.i.DROPPED, 'N/A'].join(':'))
        )
      )
    )
  )
}

PeerMetrics = Register(PeerMetrics)

async function Profile (props) {
  const {
    net,
    db,
    isMobile
  } = props

  const vProfilePositionTop = isMobile ? 90 : 48
  const vProfileTransformOrigin = isMobile ? 100 : 80
  const vProfileTransformMag = isMobile ? 0.5 : 0.05

  let elMain
  let elProfileContent

  net.socket.on('#ready', networkInfo => {
    const elPeerInfo = document.querySelector('peer-info')
    elPeerInfo.render(networkInfo)
  })

  net.socket.on('#data', async () => {
    const elPeerMetrics = document.querySelector('peer-metrics')
    metrics = await net.socket.getMetrics()
    elPeerMetrics?.render(metrics)
  })

  const { data: dataPeer } = await db.state.get('peer')

  let b64pk = ''
  let nick = ''
  let status = ''
  let clusterId = ''
  let metrics = {}

  if (dataPeer) {
    const publicKey = dataPeer.signingKeys.publicKey
    b64pk = Buffer.from(publicKey).toString('base64')
    
    const { data: dataClaim } = await db.claims.get(b64pk)

    nick = dataClaim?.nick
    status = dataClaim?.status
    clusterId = Buffer.from(dataPeer.clusterId).toString('base64')
  }

  const spring = new Spring(this, {
    axis: 'Y',
    absolute: true,
    position: function (pos) {
      const progress = pos / window.innerHeight
      const topProgress = vProfilePositionTop / window.innerHeight

      // Opacity calculation adjusted to be 1 at vProfilePositionTop
      const opacity = Math.max(0, 1 - (2.5 * (progress - topProgress)))
      this.el.style.opacity = Math.min(1, Math.max(0, opacity))

      const scale = 0.9 + (0.1 * progress ** vProfileTransformMag)

      if (!elMain) {
        elMain = document.getElementById('main')
      }

      document.body.style.background = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, opacity))})`

      elMain.style.transform = `scale(${Math.min(scale, 1)})`
      elMain.style.transformOriginY = `${vProfileTransformOrigin}%`
    },
    begin: function (event) {
      // dont slide unless the content is scrolled to the top
      if (!elProfileContent) elProfileContent = document.querySelector('profile > .content')
      if (elProfileContent.scrollTop > 0) this.isInteractive = false

      if (['BUTTON', 'INPUT'].includes(event.target.tagName)) {
        this.isInteractive = false
      }
    },
    during: function (event) {
      if (this.dy < 40) return // Ignore upward movements for pull-to-dismiss functionality

      const newPosition = Math.min(this.el.clientHeight, Math.max(vProfilePositionTop, this.dy))
      this.updatePosition('Y', newPosition)
    },
    end: function (event) {
      // Determine the final action based on the dragged distance
      const finalPosition = this.currentY
      const divHeight = this.el.clientHeight
      const threshold = divHeight / 2 // Example: 50% of the element's height

      if (Math.abs(finalPosition) < threshold) {
        // If not dragged past the threshold, start the spring animation to snap back
        this.moveTo(vProfilePositionTop)  // Snap back to the original position
      } else {
        // If dragged past the threshold, start the spring animation to dismiss or finalize the action
        this.moveTo(window.innerHeight) // Or any other final position based on your use case
      }
    }
  })

  this.moveTo = spring.moveTo.bind(spring)
  this.updateTransform = spring.updateTransform.bind(spring)

  //
  // Handle the close button
  //
  const onclick = (event, match) => {
    if (match('#profile-close')) {
      spring.moveTo(window.innerHeight)
    }
  }

  return [
    header(
      span('Profile'),
      button({ id: 'profile-close', onclick },
        svg({ class: 'app-icon' },
          use({ 'xlink:href': '#close-icon' })
        )
      )
    ),
    div({ class: 'content' },
      div({ class: 'grid' },
        Text({
          errorMessage: 'Accepts A-Z, 0-9, and "_"',
          label: 'Nickname',
          pattern: '[a-zA-Z0-9_]+',
          data: { event: 'settings-nick' },
          placeholder: 'Ace Quxx',
          value: nick
        }),
        Text({
          label: 'Public Key',
          readOnly: 'true',
          icon: 'copy-icon',
          data: { event: 'settings-public-key' },
          value: b64pk
        }),
        Text({
          label: 'Status',
          data: { event: 'settings-status' },
          value: status
        }),
        Text({
          label: 'ClusterId',
          data: { event: 'settings-clusterId' },
          value: clusterId
        })
      ),
      PeerInfo({ id: 'peer-info' }),
      PeerMetrics({ id: 'props' }),
      PeerList({ id: 'peer-list', net })
    )
  ]
}

Profile = Register(Profile)
export { Profile }
