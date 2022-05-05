import storage from '../legacy/storage'
export type YoroiStorage = typeof storage

import {TransactionInfo} from '../legacy/HistoryTransaction'

export type SubmittedTx = TransactionInfo
export type SubmittedTxs = Array<SubmittedTx>

export type WalletStorage = ReturnType<typeof walletStorage>
export function walletStorage({walletId, db}: {walletId: string; db: YoroiStorage}) {
  isStoragePathValid(walletId, 'walletId')

  const submittedTxsKey = `/wallet/${walletId}/submittedTxs`

  const submittedTxs = _submittedTxs(submittedTxsKey, db)

  return {
    submittedTxs,
  }
}

function _submittedTxs(key: string, db: YoroiStorage) {
  async function getAll() {
    return (await db.read<SubmittedTxs>(key)) ?? []
  }

  async function saveAll(data: SubmittedTxs) {
    return await db.write(key, data)
  }

  async function removeById(id: SubmittedTx['id']) {
    const data = await getAll()

    const newData = data.filter((r) => r.id !== id)

    await db.write(key, newData)
    return newData
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
    saveAll,
    removeById,
    save,
  }
}

function isStoragePathValid(str: string, fieldName: string) {
  if (!str || !str.match(/^[0-9a-zA-Z_-]+$/)) throw new Error(`Field ${fieldName} must contain only [0-9a-zA-Z_-].`)
}
