import {useNavigation} from '@react-navigation/native'
import React from 'react'
import {useIntl} from 'react-intl'
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native'

import {Icon, Spacer} from '../components'
import features from '../features'
import {actionMessages} from '../i18n/global-messages'
import {TxHistoryRouteNavigation} from '../navigation'
import {useSelectedWallet} from '../SelectedWallet'
import {COLORS} from '../theme'

const ACTION_PROPS = {
  size: 32,
  color: COLORS.WHITE,
}

export const ActionsBanner = () => {
  const strings = useStrings()
  const navigateTo = useNavigateTo()
  const wallet = useSelectedWallet()

  return (
    <View style={styles.banner}>
      <Spacer height={16} />

      <View style={styles.centralized}>
        <View style={styles.row}>
          {!wallet.isReadOnly && (
            <View style={styles.centralized}>
              <TouchableOpacity style={styles.actionIcon} onPress={navigateTo.send}>
                <Icon.Send {...ACTION_PROPS} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{strings.sendLabel}</Text>
            </View>
          )}

          {!wallet.isReadOnly && <Spacer width={32} />}

          <View style={styles.centralized}>
            <TouchableOpacity style={styles.actionIcon} onPress={navigateTo.receive}>
              <Icon.Received {...ACTION_PROPS} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{strings.receiveLabel}</Text>
          </View>

          {features.walletHero.buy && <Spacer width={32} />}

          {features.walletHero.buy && (
            <View style={styles.centralized}>
              <TouchableOpacity style={[styles.actionIcon, styles.cta]} onPress={navigateTo.buy}>
                {/* TODO: request buy icon to the design team */}
                <Text style={styles.buyButton}>+</Text>
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{strings.buyLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <Spacer height={21} />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.BACKGROUND_GRAY,
  },
  centralized: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 42,
    width: 42,
    borderRadius: 20,
    backgroundColor: COLORS.LIGHT_POSITIVE_GREEN,
  },
  buyButton: {
    textAlignVertical: 'center',
    lineHeight: 40,
    fontSize: 32,
    color: COLORS.TEXT_GRAY2,
  },
  cta: {
    borderWidth: 1,
    borderColor: COLORS.BORDER_GRAY,
    backgroundColor: COLORS.BACKGROUND_GRAY,
  },
  actionLabel: {
    paddingTop: 8,
    fontSize: 10,
    color: COLORS.TEXT_GRAY3,
    fontFamily: 'Rubik-Regular',
  },
})

const useStrings = () => {
  const intl = useIntl()

  return {
    sendLabel: intl.formatMessage(actionMessages.send),
    receiveLabel: intl.formatMessage(actionMessages.receive),
    buyLabel: intl.formatMessage(actionMessages.buy),
    messageBuy: intl.formatMessage(actionMessages.soon),
  }
}

const useNavigateTo = () => {
  const navigation = useNavigation<TxHistoryRouteNavigation>()
  const strings = useStrings()

  return {
    send: () => navigation.navigate('send'),
    receive: () => navigation.navigate('receive'),
    buy: () => Alert.alert(strings.messageBuy, strings.messageBuy),
  }
}
