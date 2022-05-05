import AsyncStorage from '@react-native-async-storage/async-storage'
import {expect} from 'chai'
import * as sinon from 'ts-sinon'

import {mockWallet} from '../../storybook/mocks/wallet'
import storage from '../legacy/storage'
import {TxStatusRequest, TxStatusResponse} from '../legacy/types'
import {walletStorage, YoroiWallet} from '../yoroi-wallets'
import {fetchTxStatus, syncSubmittedTxs} from '.'

describe('fetchTxStatus()', () => {
  // it means that the tx was sent to node and processed
  it('should return success when depth > 0', async () => {
    // arrange
    const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
    const requestShouldBe: TxStatusRequest = {
      txHashes: [txId],
    }
    const wallet = sinon.stubObject(mockWallet, {
      fetchTxStatus: Promise.resolve({
        depth: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': 1},
      } as TxStatusResponse),
    })

    // act
    const result = await fetchTxStatus(wallet, txId)

    // assert
    expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
    expect(wallet.fetchTxStatus.callCount).to.be.equal(1)
    expect(result).to.be.eql({
      status: 'SUCCESS',
    })
  })

  // the node returned an unrecoverable error i.e utxo already consumed
  it('should return error when submission status has failed', async () => {
    // arrange
    const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
    const requestShouldBe: TxStatusRequest = {
      txHashes: [txId],
    }
    const wallet = sinon.stubObject(mockWallet, {
      fetchTxStatus: Promise.resolve({
        depth: {},
        submissionStatus: {
          '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'FAILED'},
        },
      } as unknown as TxStatusResponse),
    })

    // act
    const result = await fetchTxStatus(wallet, txId)

    // assert
    expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
    expect(wallet.fetchTxStatus.callCount).to.be.equal(1)
    expect(result).to.be.eql({
      status: 'FAILED',
    })
  })

  // unabled to reach the node X times
  it('should return error when max retries failed', async () => {
    // arrange
    const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
    const requestShouldBe: TxStatusRequest = {
      txHashes: [txId],
    }
    const wallet = sinon.stubObject(mockWallet, {
      fetchTxStatus: Promise.resolve({
        depth: {},
        submissionStatus: {
          '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'MAX_RETRY_REACHED'},
        },
      } as unknown as TxStatusResponse),
    })

    // act
    const result = await fetchTxStatus(wallet, txId)

    // assert
    expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
    expect(wallet.fetchTxStatus.callCount).to.be.equal(1)
    expect(result).to.be.eql({
      status: 'MAX_RETRY_REACHED',
    })
  })

  it('should return waiting when does not want to wait for processig', async () => {
    // arrange
    const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
    const requestShouldBe: TxStatusRequest = {
      txHashes: [txId],
    }
    const wallet = sinon.stubObject(mockWallet, {
      fetchTxStatus: Promise.resolve({
        depth: {},
        submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'WAITING'}},
      } as unknown as TxStatusResponse),
    })

    // act
    const result = await fetchTxStatus(wallet, txId)

    // assert
    expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
    expect(wallet.fetchTxStatus.callCount).to.be.equal(1)
    expect(result).to.be.eql({
      status: 'WAITING',
    })
  })

  // empty return whould waiting and return waiting
  it('should return waiting when no submission nor depth data is returned', async () => {
    // arrange
    const waitProcessing = true
    const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
    const requestShouldBe: TxStatusRequest = {
      txHashes: [txId],
    }
    const wallet = sinon.stubObject(mockWallet, {
      fetchTxStatus: Promise.resolve({
        depth: {},
      } as TxStatusResponse),
    })

    // act
    const result = await fetchTxStatus(wallet, txId, waitProcessing)

    // assert
    expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
    expect(wallet.fetchTxStatus.callCount).to.be.equal(5)
    expect(result).to.be.eql({
      status: 'WAITING',
    })
  })

  describe('waitProcessing = true', () => {
    // waited till the end and still not processed
    it('should return waiting after max retries and not processed', async () => {
      // arrange
      const waitProcessing = true
      const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
      const requestShouldBe: TxStatusRequest = {
        txHashes: [txId],
      }
      const wallet = sinon.stubObject(mockWallet, {
        fetchTxStatus: Promise.resolve({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'WAITING'}},
        } as unknown as TxStatusResponse),
      })

      // act
      const result = await fetchTxStatus(wallet, txId, waitProcessing)

      // assert
      expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
      expect(wallet.fetchTxStatus.callCount).to.be.equal(5)
      expect(result).to.be.eql({
        status: 'WAITING',
      })
    })

    it('should return success if processed while waiting', async () => {
      // arrange
      const waitProcessing = true
      const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
      const requestShouldBe: TxStatusRequest = {
        txHashes: [txId],
      }
      const wallet = sinon.stubObject(mockWallet)
      wallet.fetchTxStatus
        .onFirstCall()
        .resolves({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'WAITING'}},
        } as unknown as TxStatusResponse)
        .onSecondCall()
        .resolves({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'SUCCESS'}},
        } as unknown as TxStatusResponse)

      // act
      const result = await fetchTxStatus(wallet, txId, waitProcessing)

      // assert
      expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
      expect(wallet.fetchTxStatus.callCount).to.be.equal(2)
      expect(result).to.be.eql({
        status: 'SUCCESS',
      })
    })
    it('should return failed if rejected by the node while waiting', async () => {
      // arrange
      const waitProcessing = true
      const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
      const requestShouldBe: TxStatusRequest = {
        txHashes: [txId],
      }
      const wallet = sinon.stubObject(mockWallet)
      wallet.fetchTxStatus
        .onFirstCall()
        .resolves({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'WAITING'}},
        } as unknown as TxStatusResponse)
        .onSecondCall()
        .resolves({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'FAILED'}},
        } as unknown as TxStatusResponse)

      // act
      const result = await fetchTxStatus(wallet, txId, waitProcessing)

      // assert
      expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
      expect(wallet.fetchTxStatus.callCount).to.be.equal(2)
      expect(result).to.be.eql({
        status: 'FAILED',
      })
    })
    it('should return max retries failed if queue was not able to send to the node while waiting', async () => {
      // arrange
      const waitProcessing = true
      const txId = '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'
      const requestShouldBe: TxStatusRequest = {
        txHashes: [txId],
      }
      const wallet = sinon.stubObject(mockWallet)
      wallet.fetchTxStatus
        .onFirstCall()
        .resolves({
          depth: {},
          submissionStatus: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'WAITING'}},
        } as unknown as TxStatusResponse)
        .onSecondCall()
        .resolves({
          depth: {},
          submissionStatus: {
            '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {status: 'MAX_RETRY_REACHED'},
          },
        } as unknown as TxStatusResponse)

      // act
      const result = await fetchTxStatus(wallet, txId, waitProcessing)

      // assert
      expect(wallet.fetchTxStatus.alwaysCalledWith(requestShouldBe)).to.be.true
      expect(wallet.fetchTxStatus.callCount).to.be.equal(2)
      expect(result).to.be.eql({
        status: 'MAX_RETRY_REACHED',
      })
    })
  })
})

const mockSubmittedTx1 = {
  id: '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999',
  amount: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  direction: 'SENT',
  fee: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  status: 'Pending',
  submittedAt: new Date().toISOString(),
  assurance: 'PENDING',
  inputs: [],
  outputs: [],
  confirmations: 0,
  delta: [],
  lastUpdatedAt: new Date().toISOString(),
  tokens: {},
}
const mockSubmittedTx2 = {
  id: '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496100',
  amount: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  direction: 'SENT',
  fee: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  status: 'Pending',
  submittedAt: new Date().toISOString(),
  assurance: 'PENDING',
  inputs: [],
  outputs: [],
  confirmations: 0,
  delta: [],
  lastUpdatedAt: new Date().toISOString(),
  tokens: {},
}
const mockSubmittedTx3 = {
  id: '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496100',
  amount: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  direction: 'SENT',
  fee: [{amount: '1', identifier: '', isDefault: true, networkId: 300}],
  status: 'Failed',
  submittedAt: new Date().toISOString(),
  assurance: 'FAILED',
  inputs: [],
  outputs: [],
  confirmations: 0,
  delta: [],
  lastUpdatedAt: new Date().toISOString(),
  tokens: {},
}
describe('syncSubmittedTxs()', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })
  it('should not update the data when the depth < medium assurance', async () => {
    await AsyncStorage.setItem(
      `/wallet/${mockWallet.id}/submittedTxs`,
      JSON.stringify([mockSubmittedTx1, mockSubmittedTx2, mockSubmittedTx3]),
    )
    // arrange
    const wallet: YoroiWallet = {
      ...mockWallet,
      store: walletStorage({walletId: mockWallet.id, db: storage}),
      fetchTxStatus: () =>
        Promise.resolve({
          depth: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': 1},
        } as TxStatusResponse),
      checkServerStatus: () =>
        Promise.resolve({serverTime: new Date(), isMaintenance: false, isServerOk: true, isQueueOnline: false}),
    }
    const beforeSync = await wallet.store?.submittedTxs.getAll()

    // act
    const afterSync = await syncSubmittedTxs(wallet)

    // assert
    expect(afterSync).to.be.eql(beforeSync)
  })
  it('should delete the record when depth >= medium assurance (success)', async () => {
    await AsyncStorage.setItem(
      `/wallet/${mockWallet.id}/submittedTxs`,
      JSON.stringify([mockSubmittedTx1, mockSubmittedTx2]),
    )
    // arrange
    const wallet: YoroiWallet = {
      ...mockWallet,
      store: walletStorage({walletId: mockWallet.id, db: storage}),
      fetchTxStatus: () =>
        Promise.resolve({
          depth: {'12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': 20},
        } as TxStatusResponse),
      checkServerStatus: () =>
        Promise.resolve({serverTime: new Date(), isMaintenance: false, isServerOk: true, isQueueOnline: false}),
    }
    const removedWhenSuccess = await wallet.store?.submittedTxs
      .getAll()
      .then((r) => r.filter((t) => t.id !== '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999'))

    // act
    const result = await syncSubmittedTxs(wallet)

    // assert
    expect(result).to.be.eql(removedWhenSuccess)
  })
  it('should mark as failed if the queue submission status is FAILED or MAX_RETRY_REACHED', async () => {
    await AsyncStorage.setItem(
      `/wallet/${mockWallet.id}/submittedTxs`,
      JSON.stringify([mockSubmittedTx1, mockSubmittedTx2]),
    )
    // arrange
    const wallet: YoroiWallet = {
      ...mockWallet,
      store: walletStorage({walletId: mockWallet.id, db: storage}),
      fetchTxStatus: () =>
        Promise.resolve({
          submissionStatus: {
            '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496999': {
              submissionStatus: 'FAILED',
            },
            '12366dd454b4793d83d554329245d4bc67659f6f0468bb0e0d41f1ac6f496100': {
              submissionStatus: 'MAX_RETRY_REACHED',
            },
          },
        } as TxStatusResponse),
      checkServerStatus: () =>
        Promise.resolve({serverTime: new Date(), isMaintenance: false, isServerOk: true, isQueueOnline: false}),
    }
    const markedAsFailed = await wallet.store?.submittedTxs
      .getAll()
      .then((r) => r.map((t) => ({...t, status: 'Failed', assurance: 'FAILED'})))

    // act
    const result = await syncSubmittedTxs(wallet)

    // assert
    expect(result).to.be.eql(markedAsFailed)
  })
  it('should mark as failed if the hash is not in depth or submission status object and has reached the timeout', async () => {
    const expiredTtl = 7200000 * 2
    await AsyncStorage.setItem(
      `/wallet/${mockWallet.id}/submittedTxs`,
      JSON.stringify([mockSubmittedTx1, mockSubmittedTx2]),
    )
    // arrange
    const wallet: YoroiWallet = {
      ...mockWallet,
      store: walletStorage({walletId: mockWallet.id, db: storage}),
      fetchTxStatus: () =>
        Promise.resolve({
          submissionStatus: {
            otherhash: {
              submissionStatus: 'SUCCESS',
            },
          },
          depth: {otherhash: 20},
        } as TxStatusResponse),
      checkServerStatus: () =>
        Promise.resolve({
          serverTime: new Date(new Date().getTime() - expiredTtl),
          isMaintenance: false,
          isServerOk: true,
          isQueueOnline: false,
        }),
    }
    const markedAsFailed = await wallet.store?.submittedTxs
      .getAll()
      .then((r) => r.map((t) => ({...t, status: 'Failed', assurance: 'FAILED'})))

    // act
    const result = await syncSubmittedTxs(wallet)

    // assert
    expect(result).to.be.eql(markedAsFailed)
  })
})
