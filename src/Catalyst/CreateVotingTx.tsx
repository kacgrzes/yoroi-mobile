import {useNavigation} from '@react-navigation/native'
import React, {useState} from 'react'
import {defineMessages, useIntl} from 'react-intl'
import {ScrollView, StyleSheet} from 'react-native'
import {SafeAreaView} from 'react-native-safe-area-context'

import {Button, OfflineBanner, ProgressStep, Spacer, TextInput} from '../components'
import {confirmationMessages, errorMessages, txLabels} from '../i18n/global-messages'
import {ensureKeysValidity} from '../legacy/deviceSettings'
import KeyStore from '../legacy/KeyStore'
import {useSelectedWallet} from '../SelectedWallet'
import {YoroiUnsignedTx} from '../yoroi-wallets/types'
import {Actions, Description, Title} from './components'
import {useVotingRegTx} from './hooks'

type Props = {
  pin: string
  onDone: (unsignedTx: YoroiUnsignedTx) => void
}
export const CreateVotingTx = ({pin, onDone}: Props) => {
  const intl = useIntl()
  const strings = useStrings()
  const wallet = useSelectedWallet()
  const navigation = useNavigation()
  const [password, setPassword] = useState<string>()
  const [decryptedKey, setDecryptedKey] = useState<string>()
  const {unsignedTx, isLoading: generatingTransaction} = useVotingRegTx(
    {wallet, decryptedKey, pin},
    {onSuccess: onDone},
  )

  const isConfirmationDisabled = !wallet.isHW && !wallet.isEasyConfirmationEnabled && !password

  const signingMode = wallet.isHW ? 'HW' : wallet.isEasyConfirmationEnabled ? 'OS' : 'PASSWORD'

  const onContinue = async () => {
    if (wallet.isEasyConfirmationEnabled) {
      await ensureKeysValidity(wallet.id)
      navigation.navigate('biometrics', {
        keyId: wallet.id,
        onSuccess: async (decryptedKey) => {
          setDecryptedKey(decryptedKey)
          navigation.goBack()
        },
        onFail: () => navigation.goBack(),
        instructions: [strings.bioAuthInstructions],
      })

      return
    }

    const decryptedKey = await KeyStore.getData(wallet.id, 'MASTER_PASSWORD', '', password, intl)
    return setDecryptedKey(decryptedKey)
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeAreaView}>
      <ProgressStep currentStep={4} totalSteps={6} />
      <OfflineBanner />

      <ScrollView bounces={false} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="always">
        <Spacer height={48} />

        <Title>{strings.subTitle}</Title>

        <Spacer height={16} />

        <Description>{strings.description}</Description>

        {!wallet.isEasyConfirmationEnabled && (
          <>
            <Spacer height={48} />
            <TextInput
              autoFocus
              secureTextEntry
              label={strings.password}
              value={password}
              onChangeText={setPassword}
              autoComplete={false}
            />
          </>
        )}
      </ScrollView>

      <Spacer fill />

      <Actions>
        <Button
          onPress={onContinue}
          title={strings.confirmButton}
          disabled={isConfirmationDisabled || generatingTransaction}
        />
      </Actions>
    </SafeAreaView>
  )
}

const messages = defineMessages({
  subTitle: {
    id: 'components.catalyst.step4.subTitle',
    defaultMessage: '!!!Enter Spending Password',
  },
  description: {
    id: 'components.catalyst.step4.description',
    defaultMessage: '!!!Enter your spending password to be able to generate the required certificate for voting',
  },
  bioAuthInstructions: {
    id: 'components.catalyst.step4.bioAuthInstructions',
    defaultMessage: '!!!Please authenticate so that Yoroi can generate the required certificate for voting',
  },
})

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
})

const useStrings = () => {
  const intl = useIntl()

  return {
    subTitle: intl.formatMessage(messages.subTitle),
    description: intl.formatMessage(messages.description),
    password: intl.formatMessage(txLabels.password),
    confirmButton: intl.formatMessage(confirmationMessages.commonButtons.confirmButton),
    errorTitle: intl.formatMessage(errorMessages.generalTxError.title),
    errorMessage: intl.formatMessage(errorMessages.generalTxError.message),
    bioAuthInstructions: intl.formatMessage(messages.bioAuthInstructions),
  }
}
