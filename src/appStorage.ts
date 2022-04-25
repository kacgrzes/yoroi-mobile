import {WalletMeta} from './legacy/state'
import {YoroiStorage} from './yoroi-wallets/storage'

export function WalletManager(db: YoroiStorage) {
  async function getWallets() {
    const walletKeys = await db.keys('/wallet/')

    const result = await Promise.all(walletKeys.map((key) => db.read<WalletMeta>(`/wallet/${key}`)))
    return result
  }

  return {
    getWallets,
  }
}
