import { register } from '../../lib/component.js'
import Modal from '../../components/modal.js'
import Text from '../../components/text.js'

async function ModelCreateChannel (props) {
  return Modal(
    {
      id: 'create-channel',
      header: 'Create Or Join Channel',
      style: { width: '420px' },
      buttons: [{ value: 'ok', label: 'OK', class: 'confirm' }],
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
      /* Text({
        label: 'Path To Agent Model',
        value: 'model.gguf',
        readonly: true,
        data: { slot: 'path', event: 'change-model', },
        icon: 'config-icon',
      }),
      Text({
        label: 'Initial Prompt',
        placeholder: 'You are a coding assistant focused on Web Development.',
        value: '<s>[INST]You\'re a coding assistant focused on Web Development. You try to provide concise answers about html, css, and javascript questions.[/INST]</s>',
        data: { slot: 'prompt' },
      }),
      Text({
        label: 'Temperature',
        value: '0.6',
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

export default register(ModelCreateChannel)
