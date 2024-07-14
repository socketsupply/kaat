import { register } from '../../lib/component.js'
import Modal from '../../components/modal.js'
import Text from '../../components/text.js'

async function ModelManageChannel (props) {
  return Modal(
    {
      id: 'manage-channel',
      header: 'Manage Channel',
      style: { width: '420px' },
      buttons: [
        { value: 'ok', label: 'OK' },
        { value: 'delete', label: 'Delete', event: 'delete-channel' }
      ],
      onclick
    },
    div({ class: 'grid' },
      Text({
        errorMessage: 'Nope',
        label: 'Channel Name',
        data: { slot: 'label' },
        pattern: '[a-zA-Z0-9 ]+',
        placeholder: 'Space Camp'
      }),
      Text({
        errorMessage: 'Nope',
        label: 'Access Token',
        data: { slot: 'accessToken' },
        type: 'password',
        icon: 'copy-icon',
        iconEvent: 'copy',
        placeholder: 'Channel Key'
      })
      /* Text({
        label: 'Path To Agent Model',
        value: 'model.gguf',
        readonly: true,
        data: { event: 'change-model', slot: 'path' },
        icon: 'config-icon',
      }),
      Text({
        label: 'Initial Prompt',
        value: 'You are a coding assistant focused on Web Development.',
        data: { event: 'change-model-prompt', slot: 'prompt' },
      }),
      Text({
        label: 'Temperature',
        value: '1.1',
        data: { event: 'change-model-prompt', slot: 'temp' },
      }),
      Group({ label: 'More Options', class: 'grid bottom-aligned padded' },
        Switch({
          label: 'ChatML',
          value: false,
          data: { event: 'change-model-chatml', slot: 'chatml' },
        }),
        Switch({
          label: 'Instruct',
          value: false,
          data: { event: 'change-model-instruct', slot: 'instruct' },
        }),
        Switch({
          label: 'Conversation',
          value: false,
          data: { event: 'change-model-conversation', slot: 'conversation' },
        })
      ) */
    )
  )
}

export default register(ModelManageChannel)
