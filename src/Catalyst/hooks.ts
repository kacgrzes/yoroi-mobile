import {useQuery, UseQueryOptions} from 'react-query'

import {YoroiWallet} from '../yoroi-wallets'
import {YoroiUnsignedTx} from '../yoroi-wallets/types'

export const useVotingRegTx = (
  {wallet, pin, decryptedKey}: {wallet: YoroiWallet; pin?: string; decryptedKey?: string},
  options?: UseQueryOptions<YoroiUnsignedTx, Error>,
) => {
  const query = useQuery({
    queryKey: [wallet.id, 'votingRegTx'],
    queryFn: async () => {
      if (!pin) throw new Error('invalid state')
      if (!decryptedKey) throw new Error('invalid state')

      return wallet.createVotingRegTx(decryptedKey, pin)
    },
    enabled: [pin, decryptedKey].every(Boolean),
    ...options,
  })

  return {
    votingRegTx: query.data,
    ...query,
  }
}
