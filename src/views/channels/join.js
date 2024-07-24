import { register } from '../../lib/component.js'
import Modal from '../../components/modal.js'
import Text from '../../components/text.js'

async function ModelJoinChannel (props) {
  return Modal(
    {
      id: 'join-channel',
      header: 'Join Channel',
      style: { width: '420px' },
      buttons: [{ value: 'ok', label: 'Join', class: 'confirm' }],
      onclick
    },
    div({ class: 'grid' },
      Text({
        errorMessage: 'Nope',
        label: 'Channel Name',
        pattern: '[a-zA-Z0-9 ]+',
        data: { slot: 'label' },
        placeholder: 'Space Camp'
      }),
      Text({
        errorMessage: 'Nope',
        label: 'Access Token',
        type: 'password',
        icon: 'copy-icon',
        iconEvent: 'copy',
        data: { slot: 'accessToken' },
        placeholder: 'c52d1bf7-1875-4d2f-beee-bbfe46f11174'
      })
    )
  )
}

export default register(ModelJoinChannel)
