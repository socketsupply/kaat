import Indexed from '@socketsupply/indexed'
import application from 'socket:application'

async function reset () {
  const databases = await window.indexedDB.databases()
  for (const { name } of databases) await Database.drop(name)
  application.exit(0)
}

if (process.env.RESET === '1') {
  reset()
}

Indexed.onerror = err => {
  console.error(err)
}

const database = async () => ({
  groups: await Indexed.open('groups'),
  channels: await Indexed.open('channels'),
  claims: await Indexed.open('claims'),
  trusted: await Indexed.open('trusted'),
  indexes: await Indexed.open('indexes'),
  messages: await Indexed.open('messages'),
  state: await Indexed.open('state')
})

export { database }

