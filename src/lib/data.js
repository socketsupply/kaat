import Indexed from '@socketsupply/indexed'
import application from 'socket:application'

//
// Don't do top level awaits unless your absolutely need to. It can be a
// foot-gun since it will convert all your imports from static to dynamic.
//
globalThis.resetData = async () => {
  const databases = await window.indexedDB.databases()
  for (const db of databases) await Indexed.drop(db.name)
  application.exit(0)
}

Indexed.onerror = err => {
  console.error(err)
}

const database = async () => {
  // await globalThis.resetData()
  const tables = {
    channels: await Indexed.open('channels'),
    claims: await Indexed.open('claims'),
    trusted: await Indexed.open('trusted'),
    indexes: await Indexed.open('indexes'),
    state: await Indexed.open('state')
  }

  const { data: dataChannels } = await tables.channels.readAll()

  for (const k of dataChannels.keys()) {
    tables[k] = await Indexed.open(k)
  }

  return tables
}

export { database }

