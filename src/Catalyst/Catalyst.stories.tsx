import {action} from '@storybook/addon-actions'
import {storiesOf} from '@storybook/react-native'
import React from 'react'

import {WithModalProps} from '../../storybook'
import {CatalystBackupCheck} from './CatalystBackupCheck'
import {VotingRegTxData} from './hooks'
import {VotingLanding} from './Step1'
import {DisplayVotingPin} from './Step2'
import {ConfirmVotingPin} from './Step3'
import {CreateVotingTx} from './Step4'
import {Step5} from './Step5'
import {Step6} from './Step6'

storiesOf('Catalyst', module)
  .add('Step 1', () => <VotingLanding setPin={action('setPin')} />)
  .add('Step 2', () => <DisplayVotingPin pin="1234" />)
  .add('Step 3', () => <ConfirmVotingPin pin="1234" setVotingRegTxData={action('setVotingRegTxData')} />)
  .add('Step 4', () => <CreateVotingTx pin="1234" setVotingRegTxData={action('setVotingRegTxData')} />)
  .add('Step 5', () => <Step5 votingRegTxData={{} as unknown as VotingRegTxData} />)
  .add('Step 6', () => <Step6 votingRegTxData={{} as unknown as VotingRegTxData} />)
  .add('CatalystBackupCheckModal', () => (
    <WithModalProps>
      {(modalProps) => <CatalystBackupCheck {...modalProps} onConfirm={action('onConfirm')} />}
    </WithModalProps>
  ))
