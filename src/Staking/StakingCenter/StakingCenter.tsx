/* eslint-disable @typescript-eslint/no-explicit-any */
import {useNavigation} from '@react-navigation/native'
import {BigNumber} from 'bignumber.js'
import React, {useEffect, useState} from 'react'
import type {IntlShape} from 'react-intl'
import {defineMessages, useIntl} from 'react-intl'
import {ActivityIndicator, View} from 'react-native'
import {WebView, WebViewMessageEvent} from 'react-native-webview'
import {useSelector} from 'react-redux'

import {AccountAutoRefresher} from '../../AccountAutoRefresher'
import {PleaseWaitModal, Spacer} from '../../components'
import {useLanguage} from '../../i18n'
import globalMessages, {errorMessages} from '../../i18n/global-messages'
import {showErrorDialog} from '../../legacy/actions'
import {
  CONFIG,
  getDefaultAssetByNetworkId,
  getTestStakingPool,
  isNightly,
  SHOW_PROD_POOLS_IN_DEV,
} from '../../legacy/config'
import {InsufficientFunds} from '../../legacy/errors'
import {ApiError, NetworkError} from '../../legacy/errors'
import {normalizeTokenAmount} from '../../legacy/format'
import {Logger} from '../../legacy/logging'
import {getNetworkConfigById} from '../../legacy/networks'
import {
  accountBalanceSelector,
  isFetchingUtxosSelector,
  poolOperatorSelector,
  utxosSelector,
} from '../../legacy/selectors'
import {RawUtxo} from '../../legacy/types'
import {StakingCenterRouteNavigation} from '../../navigation'
import {useSelectedWallet} from '../../SelectedWallet'
import {DefaultAsset} from '../../types'
import {UtxoAutoRefresher} from '../../UtxoAutoRefresher'
import {YoroiWallet} from '../../yoroi-wallets'
import {PoolDetailScreen} from '../PoolDetails'
import {PoolWarningModal} from '../PoolWarningModal'

export const StakingCenter = () => {
  const intl = useIntl()
  const navigation = useNavigation<StakingCenterRouteNavigation>()
  const [amountToDelegate, setAmountToDelegate] = useState<string | null>(null)
  const [selectedPools, setSelectedPools] = useState<Array<SelectedPool>>([])
  const [reputationInfo, setReputationInfo] = useState({})
  const [showPoolWarning, setShowPoolWarning] = useState(false)
  const [busy, setBusy] = useState(false)

  const isFetchingUtxos = useSelector(isFetchingUtxosSelector)
  const utxos = useSelector(utxosSelector)
  const accountBalance = useSelector(accountBalanceSelector)
  const poolOperator = useSelector(poolOperatorSelector)
  const {languageCode} = useLanguage()
  const wallet = useSelectedWallet()
  const config = getNetworkConfigById(wallet.networkId)
  const isMainnet = config.IS_MAINNET

  const nightlyAndDevPoolHashes = getTestStakingPool(wallet.networkId, wallet.provider)

  // pools user is currently delegating to
  const poolList = poolOperator != null ? [poolOperator] : null

  const handleOnPress = (poolHash: string) => {
    const selectedPoolHashes = poolHash ? [poolHash] : nightlyAndDevPoolHashes
    Logger.debug('manual inputted or config pool:', selectedPoolHashes)
    delegate(selectedPoolHashes)
  }

  const handleOnMessage = async (event: WebViewMessageEvent) => {
    if (isFetchingUtxos) {
      return showErrorDialog(waitSyncDialog, intl)
    }
    const selectedPoolHashes = JSON.parse(decodeURI(event.nativeEvent.data))
    if (!Array.isArray(selectedPoolHashes) || selectedPoolHashes.length < 1) {
      await showErrorDialog(noPoolDataDialog, intl)
    }
    Logger.debug('selected pools from explorer:', selectedPoolHashes)
    delegate(selectedPoolHashes)
  }

  const delegate = async (selectedPoolHashes: Array<string>) => {
    try {
      setBusy(true)

      if (selectedPoolHashes.length) {
        await handleSelectedPoolHashes(
          selectedPoolHashes,
          setSelectedPools,
          setReputationInfo,
          setShowPoolWarning,
          accountBalance,
          utxos || [],
          getDefaultAssetByNetworkId(wallet.networkId),
          intl,
          navigation,
          wallet,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(
    () => {
      const getAmountToDelegate: () => Promise<void> = async () => {
        if (utxos != null) {
          const utxosForKey = await wallet.getAllUtxosForKey(utxos)
          const _amountToDelegate = utxosForKey
            .map((utxo) => utxo.amount)
            .reduce((x: BigNumber, y) => x.plus(new BigNumber(y || 0)), new BigNumber(0))
          setAmountToDelegate(
            normalizeTokenAmount(_amountToDelegate, getDefaultAssetByNetworkId(wallet.networkId)).toString(),
          )
        }
      }

      getAmountToDelegate()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [utxos],
  )

  return (
    <>
      {(__DEV__ || (isNightly() && !isMainnet)) && (
        <View style={{flex: 1}}>
          <PoolDetailScreen
            onPressDelegate={(poolHash) => handleOnPress(poolHash)}
            disabled={!nightlyAndDevPoolHashes.length || isFetchingUtxos || !utxos}
          />
        </View>
      )}
      {(isMainnet || SHOW_PROD_POOLS_IN_DEV) && (
        <>
          <View style={{flex: 1, backgroundColor: '#fff'}}>
            <Spacer height={8} />
            <UtxoAutoRefresher />
            <AccountAutoRefresher />
            {isFetchingUtxos && <ActivityIndicator color="black" />}
            <WebView
              androidLayerType="software"
              source={{
                uri: prepareStakingURL(poolList, amountToDelegate, languageCode),
              }}
              onMessage={(event) => handleOnMessage(event)}
            />
          </View>
          <PoolWarningModal
            visible={showPoolWarning}
            onPress={async () => {
              setShowPoolWarning(false)
              await navigateToDelegationConfirm(
                accountBalance,
                utxos || [],
                selectedPools,
                getDefaultAssetByNetworkId(wallet.networkId),
                intl,
                navigation,
                wallet,
              )
            }}
            onRequestClose={() => setShowPoolWarning(false)}
            reputationInfo={reputationInfo}
          />
          <PleaseWaitModal title="" spinnerText={intl.formatMessage(globalMessages.pleaseWait)} visible={busy} />
        </>
      )}
    </>
  )
}

const noPoolDataDialog = defineMessages({
  title: {
    id: 'components.stakingcenter.noPoolDataDialog.title',
    defaultMessage: '!!!Invalid Pool Data',
  },
  message: {
    id: 'components.stakingcenter.noPoolDataDialog.message',
    defaultMessage: '!!!The data from the stake pool(s) you selected is invalid. Please try again',
  },
})

const waitSyncDialog = defineMessages({
  title: {
    id: 'global.tryAgain',
    defaultMessage: '!!!Try again',
  },
  message: {
    id: 'global.actions.dialogs.walletSynchronizing',
    defaultMessage: '!!!Wallet is syncronizing',
  },
})

type SelectedPool = {
  poolName?: string
  poolHash: string
}

/**
 * Prepares WebView's target staking URI
 * @param {*} poolList : Array of delegated pool hash
 */
const prepareStakingURL = (poolList: Array<string> | null, amountToDelegate: string | null, locale: string): string => {
  // source=mobile is constant and already included
  let finalURL = CONFIG.NETWORKS.HASKELL_SHELLEY.POOL_EXPLORER

  const lang = locale.slice(0, 2)
  finalURL += `&lang=${lang}`

  if (poolList != null) {
    finalURL += `&delegated=${encodeURIComponent(JSON.stringify(poolList))}`
  }
  if (amountToDelegate != null) {
    finalURL += `&totalAda=${amountToDelegate}`
  }
  return finalURL
}

const navigateToDelegationConfirm = async (
  accountBalance: BigNumber | undefined | null,
  utxos: Array<RawUtxo>,
  selectedPools: Array<SelectedPool>,
  defaultAsset: DefaultAsset,
  intl: IntlShape,
  navigation: StakingCenterRouteNavigation,
  wallet: YoroiWallet,
) => {
  try {
    const selectedPool = selectedPools[0]
    if (accountBalance == null) return

    const yoroiUnsignedTx = await wallet.createDelegationTx(selectedPool.poolHash, accountBalance, utxos, defaultAsset)

    navigation.navigate('delegation-confirmation', {
      poolName: selectedPool?.poolName ?? '',
      poolHash: selectedPool.poolHash,
      yoroiUnsignedTx,
    })
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      await showErrorDialog(errorMessages.insufficientBalance, intl)
    } else {
      Logger.error(e as any)
      await showErrorDialog(errorMessages.generalError, intl, {
        message: (e as Error).message,
      })
    }
  }
}

const handleSelectedPoolHashes = async (
  selectedPoolHashes: Array<string>,
  setSelectedPools: (selectedPools: Array<SelectedPool>) => void,
  setReputationInfo: (reputationInfo: Record<string, unknown>) => void,
  setShowPoolWarning: (showPoolWarning: boolean) => void,
  accountBalance: BigNumber | undefined | null,
  utxos: Array<RawUtxo>,
  defaultAsset,
  intl: IntlShape,
  navigation,
  wallet: YoroiWallet,
) => {
  try {
    const poolInfoResponse = await wallet.fetchPoolInfo({
      poolIds: selectedPoolHashes,
    })
    const poolInfo = Object.values(poolInfoResponse)[0]
    Logger.debug('StakingCenter::poolInfo', poolInfo)

    // TODO: fetch reputation info once an endpoint is implemented
    const poolsReputation: {[key: string]: SelectedPool} = {}

    if ('info' in poolInfo) {
      const selectedPools: Array<SelectedPool> = [
        {
          poolName: poolInfo.info.name,
          poolHash: selectedPoolHashes[0],
        },
      ]
      setSelectedPools(selectedPools)

      // check if pool in blacklist
      const poolsInBlackList: Array<string> = []
      for (const pool of selectedPoolHashes) {
        if (pool in poolsReputation) {
          poolsInBlackList.push(pool)
        }
      }
      if (poolsInBlackList.length > 0) {
        setReputationInfo(poolsReputation[poolsInBlackList[0]])
        setShowPoolWarning(true)
      } else {
        await navigateToDelegationConfirm(accountBalance, utxos, selectedPools, defaultAsset, intl, navigation, wallet)
      }
    } else {
      await showErrorDialog(noPoolDataDialog, intl)
    }
  } catch (e) {
    if (e instanceof NetworkError) {
      await showErrorDialog(errorMessages.networkError, intl)
    } else if (e instanceof ApiError) {
      await showErrorDialog(noPoolDataDialog, intl)
    } else {
      Logger.error(e as any)
      await showErrorDialog(errorMessages.generalError, intl, {
        message: (e as Error).message,
      })
    }
  }
}
