import { Register } from '../lib/component.js'
import { Modal } from '../components/modal.js'

//
// A component for audio-video streams (not-ready)
//
async function VideoGrid (props) {
  return [
    div({ class: 'video-info' },
      div({ class: 'video-wrapper' },
        video({ id: 'local-video', controls: false, autoplay: true, playsinline: true })
      )
    ),
    div({ class: 'video-info' },
      div({ class: 'video-wrapper' },
        video({ id: 'remote-video', controls: false, autoplay: true, playsinline: true })
      )
    )
  ]
}

VideoGrid = Register(VideoGrid)

async function ModalVideoStreams (props) {

  return Modal(
    {
      id: 'video-streams',
      header: 'Audio streams',
      buttons: [
        { label: 'Stop', event: 'stop-stream' },
        { label: 'Start', event: 'start-stream', class: 'confirm' }
      ],
      onclick
    },
    AudioGrid({ id: 'video-grid' })
  )
}

ModalAudioStreams = Register(ModalAudioStreams)

export { ModalAudioStreams }
 
