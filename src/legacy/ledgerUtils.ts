/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DeviceOwnedAddress,
  GetExtendedPublicKeyRequest,
  GetExtendedPublicKeyResponse,
  GetSerialResponse,
  GetVersionResponse,
  SignTransactionRequest,
  SignTransactionResponse,
} from '@cardano-foundation/ledgerjs-hw-app-cardano'
import AppAda, {AddressType, DeviceStatusCodes} from '@cardano-foundation/ledgerjs-hw-app-cardano'
import TransportBLE from '@ledgerhq/react-native-hw-transport-ble'
import TransportHID from '@v-almonacid/react-native-hid'
import {PermissionsAndroid, Platform} from 'react-native'
import {BleError} from 'react-native-ble-plx'

import {ledgerMessages} from '../i18n/global-messages'
import LocalizableError from '../i18n/LocalizableError'
import {Logger} from '../legacy/logging'
import {
  BaseAddress,
  Bip32PublicKey,
  BootstrapWitness,
  BootstrapWitnesses,
  ByronAddress,
  CardanoTypes,
  Ed25519Signature,
  hashTransaction,
  RewardAddress,
  Transaction,
  TransactionWitnessSet,
  Vkey,
  Vkeywitness,
  Vkeywitnesses,
} from '../yoroi-wallets'
import {YoroiUnsignedTx} from '../yoroi-wallets/types'
import {CONFIG, isByron, isHaskellShelley} from './config'
import {getNetworkConfigById} from './networks'
import {NUMBERS} from './numbers'
import type {Addressing, NetworkId, WalletImplementationId} from './types'
import {derivePublicByAddressing, normalizeToAddress, verifyFromBip44Root} from './utils'

//
// ============== Errors ==================
//
export class BluetoothDisabledError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.bluetoothDisabledError.id,
      defaultMessage: ledgerMessages.bluetoothDisabledError.defaultMessage,
    })
  }
}
export class GeneralConnectionError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.connectionError.id,
      defaultMessage: ledgerMessages.connectionError.defaultMessage,
    })
  }
}
// note: uses same message as above.
export class LedgerUserError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.connectionError.id,
      defaultMessage: ledgerMessages.connectionError.defaultMessage,
    })
  }
}
export class RejectedByUserError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.rejectedByUserError.id,
      defaultMessage: ledgerMessages.rejectedByUserError.defaultMessage,
    })
  }
}
export class DeprecatedAdaAppError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.deprecatedAdaAppError.id,
      defaultMessage: ledgerMessages.deprecatedAdaAppError.defaultMessage,
      values: {
        version: `${CONFIG.HARDWARE_WALLETS.LEDGER_NANO.MIN_ADA_APP_VERSION}`,
      },
    })
  }
}
export class NoDeviceInfoError extends LocalizableError {
  constructor() {
    super({
      id: ledgerMessages.noDeviceInfoError.id,
      defaultMessage: ledgerMessages.noDeviceInfoError.defaultMessage,
    })
  }
}

const _isConnectionError = (e: Error | any): boolean => {
  if (
    e instanceof BleError ||
    e.message.includes('was disconnected') ||
    e.message.includes('DisconnectedDevice') ||
    e.name.includes('DisconnectedDevice') ||
    e.message.includes('not found')
  ) {
    return true
  }

  return false
}

// note: e.statusCode === DeviceErrorCodes.ERR_CLA_NOT_SUPPORTED is more probably due
// to user not having ADA app opened instead of having the wrong app opened
const _isUserError = (e: Error | any): boolean => {
  if (e && e.code != null && e.code === DeviceStatusCodes.ERR_CLA_NOT_SUPPORTED) {
    return true
  }

  return false
}

const _isRejectedError = (e: Error | any): boolean => {
  if (e && e.code != null && e.code === DeviceStatusCodes.ERR_REJECTED_BY_USER) {
    return true
  }

  return false
}

const mapLedgerError = (e: Error | any): Error | LocalizableError => {
  if (_isUserError(e)) {
    Logger.info('ledgerUtils::mapLedgerError: User-side error', e)
    return new LedgerUserError()
  } else if (_isRejectedError(e)) {
    Logger.info('ledgerUtils::mapLedgerError: Rejected by user error', e)
    return new RejectedByUserError()
  } else if (_isConnectionError(e)) {
    Logger.info('ledgerUtils::mapLedgerError: General/BleError', e)
    return new GeneralConnectionError()
  } else if (e instanceof DeprecatedAdaAppError) {
    Logger.info('ledgerUtils::mapLedgerError: Deprecated Ada app', e)
    return e
  } else {
    Logger.error('ledgerUtils::mapLedgerError: Unexpected error', e)
    return e
  }
}
//
// ============== Types ==================
//
type WalletType = 'BIP44' | 'CIP1852'
// this type is used by @ledgerhq/react-native-hid and it's not exposed
// so we redefine it here
export type DeviceObj = {
  vendorId: number
  productId: number
}
// for bluetooth, we just save a string id
export type DeviceId = string
// these are defined in LedgerConnectStore.js in yoroi-frontend
type LedgerConnectionResponse = {
  extendedPublicKeyResp: GetExtendedPublicKeyResponse
  deviceId: DeviceId | null | undefined
  deviceObj: DeviceObj | null | undefined
  serialHex: string
}
// Hardware wallet device Features object
// borrowed from HWConnectStoreTypes.js in yoroi-frontend
export type HWFeatures = {
  vendor: string
  model: string
  deviceId: DeviceId | null | undefined
  // for establishing a connection through BLE
  deviceObj: DeviceObj | null | undefined
  // for establishing a connection through USB
  serialHex?: string
}
export type HWDeviceInfo = {
  bip44AccountPublic: string
  hwFeatures: HWFeatures
}
//
// ============== General util ==================
//
const VENDOR = CONFIG.HARDWARE_WALLETS.LEDGER_NANO.VENDOR
const MODEL = CONFIG.HARDWARE_WALLETS.LEDGER_NANO.MODEL
const HARDENED = CONFIG.NUMBERS.HARD_DERIVATION_START
const WALLET_TYPE_PURPOSE = CONFIG.NUMBERS.WALLET_TYPE_PURPOSE
const COIN_TYPE = CONFIG.NUMBERS.COIN_TYPES.CARDANO

const getWalletType = (id: WalletImplementationId): WalletType => {
  if (isByron(id)) {
    return 'BIP44'
  } else if (isHaskellShelley(id)) {
    return 'CIP1852'
  } else {
    throw new Error('ledgerUtils::getWalletType: wallet type not supported')
  }
}

const makeCardanoAccountBIP44Path: (walletType: WalletType, account: number) => GetExtendedPublicKeyRequest = (
  walletType: WalletType,
  account: number,
) => ({
  path: [WALLET_TYPE_PURPOSE[walletType], COIN_TYPE, HARDENED + account],
})

const validateHWResponse = (resp: LedgerConnectionResponse): boolean => {
  const {extendedPublicKeyResp, deviceId, deviceObj, serialHex} = resp

  if (deviceId == null && deviceObj == null) {
    throw new Error('LedgerUtils::validateHWResponse: a non-null descriptor is required')
  }

  if (extendedPublicKeyResp == null) {
    throw new Error('LedgerUtils::validateHWResponse: extended public key is undefined')
  }

  if (serialHex == null) {
    throw new Error('LedgerUtils::validateHWResponse: device serial number is undefined')
  }

  return true
}

const normalizeHWResponse = (resp: LedgerConnectionResponse): HWDeviceInfo => {
  validateHWResponse(resp)
  const {extendedPublicKeyResp, deviceId, deviceObj, serialHex} = resp
  return {
    bip44AccountPublic: extendedPublicKeyResp.publicKeyHex + extendedPublicKeyResp.chainCodeHex,
    hwFeatures: {
      vendor: VENDOR,
      model: MODEL,
      deviceId,
      deviceObj,
      serialHex,
    },
  }
}

export const checkDeviceVersion = (versionResponse: GetVersionResponse): void => {
  if (
    versionResponse.version.major == null ||
    versionResponse.version.minor == null ||
    versionResponse.version.patch == null
  ) {
    Logger.warn('ledgerUtils::checkDeviceVersion: incomplete version data from device')
    return
  }

  const deviceVersionArray = [
    versionResponse.version.major,
    versionResponse.version.minor,
    versionResponse.version.patch,
  ]
  const minVersionArray = CONFIG.HARDWARE_WALLETS.LEDGER_NANO.MIN_ADA_APP_VERSION.split('.')

  if (minVersionArray.length !== deviceVersionArray.length) {
    Logger.warn('ledgerUtils::checkDeviceVersion: version formats mismatch')
    return
  }

  for (let i = 0; i < minVersionArray.length; i++) {
    const minRequired = parseInt(minVersionArray[i], 10)

    if (deviceVersionArray[i] < minRequired) {
      throw new DeprecatedAdaAppError()
    }

    if (deviceVersionArray[i] > minRequired) {
      // This part of the version is greater than the min required
      // which means next parts don't need to be checked
      // E.g. [3, 0, 0] is greater than [2, 9, 9] just because the 3 is greater than 2
      break
    }
  }
}

const connectionHandler = async (
  deviceId: DeviceId | null | undefined,
  deviceObj: DeviceObj | null | undefined,
  useUSB = false,
): Promise<AppAda> => {
  let transport

  if (useUSB) {
    if (deviceObj == null) {
      throw new Error('ledgerUtils::connectionHandler deviceObj is null')
    }

    transport = await TransportHID.open(deviceObj)
  } else {
    if (deviceId == null) {
      throw new Error('ledgerUtils::connectionHandler deviceId is null')
    }

    // check for permissions just in case
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
    }

    transport = await TransportBLE.open(deviceId)
  }

  const appAda = new AppAda(transport)
  const versionResp: GetVersionResponse = await appAda.getVersion()
  Logger.debug('ledgerUtils::connectionHandler: AppAda version', versionResp)
  checkDeviceVersion(versionResp)
  return appAda
}

export const getHWDeviceInfo = async (
  walletImplementationId: WalletImplementationId,
  deviceId: DeviceId | null | undefined,
  deviceObj: DeviceObj | null | undefined,
  useUSB = false,
): Promise<HWDeviceInfo> => {
  try {
    Logger.debug('ledgerUtils::getHWDeviceInfo called')
    const appAda = await connectionHandler(deviceId, deviceObj, useUSB)
    // assume single account in Yoroi
    const accountPath = makeCardanoAccountBIP44Path(getWalletType(walletImplementationId), CONFIG.NUMBERS.ACCOUNT_INDEX)
    Logger.debug('bip44 account path', accountPath)
    // get Cardano's first account
    // i.e hdPath = [2147483692, 2147485463, 2147483648]
    const extendedPublicKeyResp: GetExtendedPublicKeyResponse = await appAda.getExtendedPublicKey(accountPath)
    Logger.debug('extended public key', extendedPublicKeyResp)
    const serial: GetSerialResponse = await appAda.getSerial()
    const hwDeviceInfo = normalizeHWResponse({
      extendedPublicKeyResp,
      deviceId,
      deviceObj,
      ...serial,
    })
    Logger.info('ledgerUtils::getHWDeviceInfo: Ledger device OK')
    Logger.info('hwDeviceInfo', hwDeviceInfo)
    await appAda.transport.close()
    return hwDeviceInfo
  } catch (e) {
    throw mapLedgerError(e)
  }
}
export const verifyAddress = async (
  walletImplementationId: WalletImplementationId,
  networkId: NetworkId,
  byronNetworkMagic: number,
  address: string,
  addressing: Addressing['addressing'],
  hwDeviceInfo: HWDeviceInfo,
  useUSB = false,
): Promise<void> => {
  try {
    Logger.debug('ledgerUtils::verifyAddress called')
    Logger.debug('hwDeviceInfo', hwDeviceInfo)
    Logger.debug('path', addressing.path)
    Logger.debug('useUSB', useUSB)

    if (hwDeviceInfo == null) {
      throw new Error('ledgerUtils::verifyAddress: hwDeviceInfo is null')
    }

    verifyFromBip44Root(addressing)
    const addressPtr = await normalizeToAddress(address)
    let chainNetworkId = CONFIG.NETWORKS.HASKELL_SHELLEY.CHAIN_NETWORK_ID
    const networkConfig = getNetworkConfigById(networkId)

    if ('CHAIN_NETWORK_ID' in networkConfig && networkConfig.CHAIN_NETWORK_ID != null) {
      chainNetworkId = networkConfig.CHAIN_NETWORK_ID
    }

    const stakingKeyAddressing = {}

    if (isHaskellShelley(walletImplementationId)) {
      const baseAddr = await BaseAddress.fromAddress(addressPtr as any)

      if (baseAddr) {
        const rewardAddr = await RewardAddress.new(Number.parseInt(chainNetworkId, 10), await baseAddr.stakeCred())
        const addressPayload = Buffer.from(await (await rewardAddr.toAddress()).toBytes()).toString('hex')
        stakingKeyAddressing[addressPayload] = {
          path: [
            CONFIG.NUMBERS.WALLET_TYPE_PURPOSE.CIP1852,
            CONFIG.NUMBERS.COIN_TYPES.CARDANO,
            CONFIG.NUMBERS.ACCOUNT_INDEX + CONFIG.NUMBERS.HARD_DERIVATION_START,
            CONFIG.NUMBERS.CHAIN_DERIVATIONS.CHIMERIC_ACCOUNT,
            CONFIG.NUMBERS.STAKING_KEY_INDEX,
          ],
          startLevel: CONFIG.NUMBERS.BIP44_DERIVATION_LEVELS.PURPOSE,
        }
      }
    }

    const addressingMap = (address) => stakingKeyAddressing[address]

    const addressParams = await toLedgerAddressParameters({
      networkId: Number.parseInt(chainNetworkId, 10),
      address: (await normalizeToAddress(address)) as any,
      path: addressing.path,
      addressingMap,
    })
    const appAda = await connectionHandler(hwDeviceInfo.hwFeatures.deviceId, hwDeviceInfo.hwFeatures.deviceObj, useUSB)
    await appAda.showAddress({
      network: {
        protocolMagic: byronNetworkMagic,
        networkId: Number.parseInt(chainNetworkId, 10),
      },
      address: addressParams,
    })
    await appAda.transport.close()
  } catch (e) {
    throw mapLedgerError(e)
  }
}
//
// ============== transaction logic ==================
//

async function toLedgerAddressParameters(request: {
  networkId: number
  address: CardanoTypes.Address
  path: Array<number>
  addressingMap: (arg0: string) => void | Addressing['addressing']
}): Promise<DeviceOwnedAddress> {
  {
    const byronAddr = await ByronAddress.fromAddress(request.address)

    if (byronAddr) {
      return {
        type: AddressType.BYRON,
        params: {
          spendingPath: request.path,
        },
      }
    }
  }
  {
    const baseAddr = await BaseAddress.fromAddress(request.address)

    if (baseAddr) {
      const rewardAddr = await RewardAddress.new(request.networkId, await baseAddr.stakeCred())
      const addressPayload = Buffer.from(await (await rewardAddr.toAddress()).toBytes()).toString('hex')
      const addressing = request.addressingMap(addressPayload)

      if (addressing == null) {
        const stakeCred = await baseAddr.stakeCred()
        const wasmHash = (await stakeCred.toKeyhash()) ?? (await stakeCred.toScripthash())

        if (wasmHash == null) {
          throw new Error('toLedgerAddressParameters unknown hash type')
        }

        const hashInAddress = Buffer.from(await wasmHash.toBytes()).toString('hex')
        return {
          type: AddressType.BASE_PAYMENT_KEY_STAKE_KEY,
          params: {
            spendingPath: request.path,
            // can't always know staking key path since address may not belong to the wallet
            // (mangled address)
            stakingKeyHashHex: hashInAddress,
          },
        }
      } else {
        return {
          type: AddressType.BASE_PAYMENT_KEY_STAKE_KEY,
          params: {
            spendingPath: request.path,
            // can't always know staking key path since address may not belong to the wallet
            // (mangled address)
            stakingPath: addressing.path,
          },
        }
      }
    }
  }
  // TODO(v-almonacid): PointerAddress not yet implemented (bindings missing)
  // TODO(v-almonacid): EnterpriseAddress not yet implemented (bindings missing)
  {
    const rewardAddr = await RewardAddress.fromAddress(request.address)

    if (rewardAddr) {
      return {
        type: AddressType.REWARD_KEY,
        params: {
          stakingPath: request.path,
        },
      }
    }
  }
  throw new Error('toLedgerAddressParameters: unknown address type')
}
export const signTxWithLedger = async (
  signRequest: SignTransactionRequest,
  hwDeviceInfo: HWDeviceInfo,
  useUSB: boolean,
): Promise<SignTransactionResponse> => {
  try {
    Logger.debug('ledgerUtils::signTxWithLedger called')

    if (hwDeviceInfo == null) {
      throw new Error('ledgerUtils::signTxWithLedger: hwDeviceInfo is null')
    }

    const appAda = await connectionHandler(hwDeviceInfo.hwFeatures.deviceId, hwDeviceInfo.hwFeatures.deviceObj, useUSB)
    Logger.debug('ledgerUtils::signTxWithLedger inputs', signRequest.tx.inputs)
    Logger.debug('ledgerUtils::signTxWithLedger outputs', signRequest.tx.outputs)
    const ledgerSignature: SignTransactionResponse = await appAda.signTransaction(signRequest)
    await appAda.transport.close()
    Logger.debug('ledgerUtils::ledgerSignature', JSON.stringify(ledgerSignature))
    return ledgerSignature
  } catch (e) {
    throw mapLedgerError(e)
  }
}
export const buildSignedTransaction = async (
  unsignedTx: YoroiUnsignedTx,
  signedLedgerTx: SignTransactionResponse,
  purpose: number,
  publicKeyHex: string,
) => {
  const key = await Bip32PublicKey.fromBytes(Buffer.from(publicKeyHex, 'hex'))
  const addressing = {
    path: [
      purpose,
      CONFIG.NUMBERS.COIN_TYPES.CARDANO,
      CONFIG.NUMBERS.ACCOUNT_INDEX + CONFIG.NUMBERS.HARD_DERIVATION_START,
    ],
    startLevel: CONFIG.NUMBERS.BIP44_DERIVATION_LEVELS.PURPOSE,
  }

  const isSameArray = (array1: Array<number>, array2: Array<number>) =>
    array1.length === array2.length && array1.every((value, index) => value === array2[index])

  const findWitness = (path: Array<number>) => {
    for (const witness of signedLedgerTx.witnesses) {
      if (isSameArray(witness.path, path)) {
        return witness.witnessSignatureHex
      }
    }

    throw new Error(`buildSignedTransaction no witness for ${JSON.stringify(path)}`)
  }

  const keyLevel = addressing.startLevel + addressing.path.length - 1
  const witSet = await TransactionWitnessSet.new()
  const bootstrapWitnesses: Array<CardanoTypes.BootstrapWitness> = []
  const vkeys: Array<CardanoTypes.Vkeywitness> = []

  // Note: Ledger removes duplicate witnesses
  // but there may be a one-to-many relationship
  // ex: same witness is used in both a bootstrap witness and a vkey witness
  const seenVKeyWit = new Set<string>()
  const seenBootstrapWit = new Set<string>()
  for (const utxo of unsignedTx.unsignedTx.senderUtxos) {
    verifyFromBip44Root(utxo.addressing)
    const witness = findWitness(utxo.addressing.path)
    const addressKey = await derivePublicByAddressing({
      addressing: utxo.addressing,
      startingFrom: {
        level: keyLevel,
        key,
      },
    })

    if (await ByronAddress.isValid(utxo.receiver)) {
      const byronAddr = await ByronAddress.fromBase58(utxo.receiver)
      const bootstrapWit = await BootstrapWitness.new(
        await Vkey.new(await addressKey.toRawKey()),
        await Ed25519Signature.fromBytes(Buffer.from(witness, 'hex')),
        await addressKey.chaincode(),
        await byronAddr.attributes(),
      )
      const asString = Buffer.from(await bootstrapWit.toBytes()).toString('hex')

      if (seenBootstrapWit.has(asString)) {
        continue
      }

      seenBootstrapWit.add(asString)
      bootstrapWitnesses.push(bootstrapWit)
      continue
    }

    const vkeyWit = await Vkeywitness.new(
      await Vkey.new(await addressKey.toRawKey()),
      await Ed25519Signature.fromBytes(Buffer.from(witness, 'hex')),
    )
    const asString = Buffer.from(await vkeyWit.toBytes()).toString('hex')

    if (seenVKeyWit.has(asString)) {
      continue
    }

    seenVKeyWit.add(asString)
    vkeys.push(vkeyWit)
  }

  // add any staking key needed
  for (const witness of signedLedgerTx.witnesses) {
    const addressing = {
      path: witness.path,
      startLevel: 1,
    }
    verifyFromBip44Root(addressing)

    if (witness.path[NUMBERS.BIP44_DERIVATION_LEVELS.CHAIN - 1] === NUMBERS.CHAIN_DERIVATIONS.CHIMERIC_ACCOUNT) {
      const stakingKey = await derivePublicByAddressing({
        addressing,
        startingFrom: {
          level: keyLevel,
          key,
        },
      })
      const vkeyWit = await Vkeywitness.new(
        await Vkey.new(await stakingKey.toRawKey()),
        await Ed25519Signature.fromBytes(Buffer.from(witness.witnessSignatureHex, 'hex')),
      )
      const asString = Buffer.from(await vkeyWit.toBytes()).toString('hex')

      if (seenVKeyWit.has(asString)) {
        continue
      }

      seenVKeyWit.add(asString)
      vkeys.push(vkeyWit)
    }
  }

  if (bootstrapWitnesses.length > 0) {
    const bootstrapWitWasm = await BootstrapWitnesses.new()

    for (const bootstrapWit of bootstrapWitnesses) {
      await bootstrapWitWasm.add(bootstrapWit)
    }

    await witSet.setBootstraps(bootstrapWitWasm)
  }

  if (vkeys.length > 0) {
    const vkeyWitWasm = await Vkeywitnesses.new()

    for (const vkey of vkeys) {
      await vkeyWitWasm.add(vkey)
    }

    await witSet.setVkeys(vkeyWitWasm)
  }

  // TODO: handle script witnesses
  const signedTx = await Transaction.new(
    unsignedTx.unsignedTx.txBody,
    witSet,
    unsignedTx.unsignedTx.auxiliaryData as any,
  )

  const id = await signedTx
    .body()
    .then((txBody) => hashTransaction(txBody))
    .then((hash) => hash.toBytes())
    .then((bytes) => Buffer.from(bytes).toString('hex'))
  const encodedTx = await signedTx.toBytes()

  return {
    id,
    encodedTx,
  }
}
