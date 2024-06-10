import Indexed from '@socketsupply/indexed'
import application from 'socket:application'

//
// Don't do top level awaits unless your absolutely need to. It can be a
// foot-gun since it will convert all your imports from static to dynamic.
//
const reset = async () => {
  const databases = await window.indexedDB.databases()
  for (const db of databases) await Indexed.drop(db.name)
  application.exit(0)
}

if (process.env.RESET === 1) {
  reset()
}

Indexed.onerror = err => {
  console.error(err)
}

const database = async () => {

  const tables = {
    groups: await Indexed.open('groups'),
    channels: await Indexed.open('channels'),
    claims: await Indexed.open('claims'),
    trusted: await Indexed.open('trusted'),
    indexes: await Indexed.open('indexes'),
    messages: await Indexed.open('messages'),
    state: await Indexed.open('state')
  }

  const { data: hasLLMConfig } = await tables.state.has('llm')

  if (!hasLLMConfig) {
    const config = {
      path: `model.gguf`,
      prompt: `<s>[INST]You're a coding assistant focused on Web Development. You try to provide concise answers about html, css, and javascript questions.[/INST]</s>`,
      chatml: false,
      conversation: true,
      // repeat_penalty: '1.1',
      // temp: '0.8',
      instruct: true,
      n_ctx: 1024
    }

    await tables.state.put('llm', config)
  }

  return tables
}

export { database }

