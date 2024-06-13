import { Register } from '../lib/component.js'
import { Modal } from '../components/modal.js'
import { Text } from '../components/text.js'

//
// TODO(@heapwolf): a bit redundant, DRY these out
//
async function ModelCreateChannel (props) {
  return Modal(
    {
      id: 'create-channel',
      header: 'Create Channel',
      style: { width: '420px' },
      buttons: [{ value: 'ok', label: 'Create', class: 'confirm' }],
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
        data: { slot: 'accessToken' },
        placeholder: 'c52d1bf7-1875-4d2f-beee-bbfe46f11174'
      }),
      Text({
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
      )
    )
  )
}
 
ModelCreateChannel = Register(ModelCreateChannel)

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
        label: 'Secret Key',
        data: { slot: 'accessToken' },
        type: 'password',
        icon: 'copy-icon',
        placeholder: 'Channel Key'
      }),
      Text({
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
      )
    )
  )
}
 
ModelManageChannel = Register(ModelManageChannel)

export {
  ModelManageChannel,
  ModelCreateChannel
}
