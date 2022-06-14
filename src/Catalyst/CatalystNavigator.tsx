import {useNavigation} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import cryptoRandomString from 'crypto-random-string'
import React, {useState} from 'react'
import {useIntl} from 'react-intl'

import globalMessages from '../i18n/global-messages'
import {CatalystRouteNavigation, CatalystRoutes, defaultStackNavigationOptions} from '../navigation'
import {useSelectedWallet} from '../SelectedWallet'
import {YoroiUnsignedTx} from '../yoroi-wallets/types'
import {useVotingRegTx} from './hooks'
import {Step1} from './Step1'
import {Step2} from './Step2'
import {Step3} from './Step3'
import {Step4} from './Step4'
import {Step5} from './Step5'
import {Step6} from './Step6'

const {Navigator, Screen} = createStackNavigator<CatalystRoutes>()
export const CatalystNavigator = () => {
  const strings = useStrings()
  const [pin] = useState(cryptoRandomString({length: 4, type: 'numeric'}))
  const navigation = useNavigation<CatalystRouteNavigation>()
  const wallet = useSelectedWallet()
  const [decryptedKey, setDecryptedKey] = useState<string>()
  const {votingRegTx} = useVotingRegTx(
    {wallet, pin, decryptedKey},
    {onSuccess: () => navigation.navigate('catalyst-transaction')},
  )

  return (
    <Navigator
      screenOptions={{...defaultStackNavigationOptions, title: strings.title}}
      initialRouteName="catalyst-landing"
    >
      <Screen name="catalyst-landing">{() => <Step1 />}</Screen>
      <Screen name="catalyst-generate-pin">{() => <Step2 pin={pin} />}</Screen>
      <Screen name="catalyst-confirm-pin">{() => <Step3 pin={pin} />}</Screen>
      <Screen name="catalyst-generate-trx">{() => <Step4 pin={pin} />}</Screen>
      <Screen name="catalyst-transaction">
        {() => {
          if (!votingRegTx) throw new Error('invalid state')
          return <Step5 votingRegTx={votingRegTx} />
        }}
      </Screen>
      <Screen name="catalyst-qr-code" options={{...defaultStackNavigationOptions, headerLeft: () => null}}>
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
