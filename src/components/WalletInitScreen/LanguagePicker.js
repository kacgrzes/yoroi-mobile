// @flow
import React from 'react'
import {connect} from 'react-redux'
import {compose} from 'redux'
import {withHandlers} from 'recompose'
import {Text, View, Picker, TouchableHighlight} from 'react-native'
import styles from './LanguagePicker.style'
import {COLORS} from '../../styles/config'
import {MAIN_ROUTES} from '../../AppNavigator'

import type {SubTranslation} from '../../l10n/typeHelpers'

import CustomText from '../CustomText'

const changeLanguageAction = (languageCode) => ({
  path: ['languageCode'],
  payload: languageCode,
  reducer: (state, languageCode) => languageCode,
  type: 'CHANGE_LANGUAGE',
})

// TODO: l10n
const supportedLangauage = [
  {label: '简体中文', name: 'Chinese (Simplified)', code: 'zh-Hans'},
  {label: '繁體中文', name: 'Chinese (Traditional)', code: 'zh-Hant'},
  {label: 'English', name: 'English', code: 'en-US'},
  {label: '日本語', name: 'Japanese', code: 'ja-JP'},
  {label: '한국어', name: 'Korean', code: 'ko-KR'},
  {label: 'i18n Russian', name: 'Russian', code: 'ru-RU'},
]


const getTrans = (state) => state.trans.languageSelectScreen

type Props = {
  changeLanguage: () => void,
  handleContinue: () => void,
  languageCode: string,
  trans: SubTranslation<typeof getTrans>
};

const LanguagePicker = ({changeLanguage, languageCode, handleContinue, trans}: Props) => (
  <View style={styles.container}>
    <View style={styles.labelContainer}>
      <CustomText>
        <Text style={styles.label}>{trans.selectLanguage}</Text>
      </CustomText>
    </View>

    <View style={styles.pickerContainer}>
      <Picker
        style={styles.picker}
        selectedValue={languageCode}
        onValueChange={changeLanguage}
      >
        {supportedLangauage.map((language) => (
          <Picker.Item
            key={language.code}
            label={language.name}
            value={language.code}
          />
        ))}
      </Picker>
    </View>

    <TouchableHighlight
      style={styles.button}
      activeOpacity={0.1}
      underlayColor={COLORS.WHITE}
      onPress={handleContinue}
    >
      <CustomText>
        <Text style={styles.buttonText}>{trans.continue}</Text>
      </CustomText>
    </TouchableHighlight>
  </View>
)

export default compose(
  connect((state) => ({
    languageCode: state.languageCode,
    trans: getTrans(state),
  }), {
    changeLanguage: changeLanguageAction,
  }),
  withHandlers({
    handleContinue: ({navigation}) => (event) => navigation.navigate(MAIN_ROUTES.TX_HISTORY),
  })
)(LanguagePicker)

