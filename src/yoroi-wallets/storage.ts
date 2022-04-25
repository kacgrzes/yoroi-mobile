import storage from '../legacy/storage'
export type YoroiStorage = typeof storage

import {TransactionInfo} from '../legacy/HistoryTransaction'

export type SubmittedTx = TransactionInfo
export type SubmittedTxs = Array<SubmittedTx>

export type WalletStorage = ReturnType<typeof walletStorage>
export function walletStorage({walletId, db}: {walletId: string; db: YoroiStorage}) {
  isStoragePathValid(walletId, 'walletId')

  const walletPath = `/wallet/${walletId}`

  const submittedTxKey = `/${walletPath}/submittedTxs`
  const submittedTx = submittedTxs(submittedTxKey, db)

  return {
    submittedTx,
  }
}

export function submittedTxs(key: string, db: YoroiStorage) {
  async function getAll() {
    return (await db.read<SubmittedTxs>(key)) ?? []
  }

  async function getById(id: SubmittedTx['id']) {
    const data = await getAll()
    return data.find((r) => r.id === id)
  }

  async function removeById(id: SubmittedTx['id']) {
    const data = await getAll()

    const newData = data.filter((r) => r.id !== id)

    await db.write(key, newData)
  }

  async function save(record: SubmittedTx) {
    const data = await getAll()

    const index = data.findIndex((r) => r.id === record.id)
    if (index !== -1) {
      data[index] = record
    } else {
      data.push(record)
    }

    return db.write(key, data)
  }

  return {
    getAll,
    getById,
    removeById,
    save,
  }
}

function isStoragePathValid(str: string, fieldName: string) {
  if (!str || !str.match(/^[0-9a-zA-Z_-]+$/)) throw new Error(`Field ${fieldName} must contain only [0-9a-zA-Z_-].`)
}
