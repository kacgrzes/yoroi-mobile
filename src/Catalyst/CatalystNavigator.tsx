import {useNavigation} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import cryptoRandomString from 'crypto-random-string'
import React, {useState} from 'react'
import {IntlShape, useIntl} from 'react-intl'
import {useQuery} from 'react-query'

import globalMessages from '../i18n/global-messages'
import KeyStore from '../legacy/KeyStore'
import {CatalystRouteNavigation, CatalystRoutes, defaultStackNavigationOptions} from '../navigation'
import {useSelectedWallet} from '../SelectedWallet'
import {YoroiWallet} from '../yoroi-wallets'
import {YoroiUnsignedTx} from '../yoroi-wallets/types'
import {ConfirmVotingPin} from './ConfirmPin'
import {Step5} from './ConfirmTx'
import {CreateVotingTx} from './CreateVotingTx'
import {DisplayVotingPin} from './DisplayPin'
import {Step6} from './DisplayQR'
import {useVotingRegTx} from './hooks'
import {VotingLanding} from './Landing'

const {Navigator, Screen} = createStackNavigator<CatalystRoutes>()
export const CatalystNavigator = () => {
  const strings = useStrings()
  const [pin] = useState(cryptoRandomString({length: 4, type: 'numeric'}))
  const navigation = useNavigation<CatalystRouteNavigation>()
  const wallet = useSelectedWallet()
  const [key, setKey] = useState<string>()
  const {votingRegTx} = useVotingRegTx({wallet, pin, key}, {onSuccess: () => navigation.navigate('transaction')})

  return (
    <Navigator screenOptions={{...defaultStackNavigationOptions, title: strings.title}} initialRouteName="initial">
      <Screen name="initial">{() => <VotingLanding />}</Screen>
      <Screen name="display-pin">{() => <DisplayVotingPin pin={pin} />}</Screen>
      <Screen name="confirm-pin">{() => <ConfirmVotingPin pin={pin} />}</Screen>
      <Screen name="create-voting-tx">{() => <CreateVotingTx pin={pin} />}</Screen>
      <Screen name="confirm-tx">
        {() => {
          if (!votingRegTx) throw new Error('invalid state')
          return <Step5 votingRegTx={votingRegTx} />
        }}
      </Screen>
      <Screen name="display-qr" options={{...defaultStackNavigationOptions, headerLeft: () => null}}>
        {() => {
          if (!votingRegTx) throw new Error('invalid state')
          return <Step6 votingRegTx={votingRegTx} />
        }}
      </Screen>
    </Navigator>
  )
}

const useStrings = () => {
  const intl = useIntl()

  return {
    title: intl.formatMessage(globalMessages.votingTitle),
  }
}

const useMasterKey = ({
  wallet,
  storage,
  password,
  intl,
}: {
  wallet: YoroiWallet
  storage: typeof KeyStore
  password?: string
  intl: IntlShape
}) => {
  const query = useQuery({
    queryKey: 'masterKey',
    queryFn: async () => storage.getData(wallet.id, 'MASTER_PASSWORD', '', password, intl),
    enabled: !!password,
  })

  return query.data
}
