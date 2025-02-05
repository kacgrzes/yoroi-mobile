import React from 'react'
import Svg, {Path} from 'react-native-svg'

type Props = {
  size?: number
  color?: string
}

export const EyeOn = ({size = 36, color = 'black'}: Props) => (
  <Svg width={size} height={size} viewBox="-2 -2 28 28">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12ZM13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z"
      fill={color}
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.05201 11.684C2.07301 11.617 4.36701 5 12 5C19.633 5 21.927 11.617 21.949 11.684L22.054 12L21.948 12.316C21.927 12.383 19.633 19 12 19C4.36701 19 2.07301 12.383 2.05101 12.316L1.94601 12L2.05201 11.684ZM4.07401 12C4.57601 13.154 6.64901 17 12 17C17.348 17 19.422 13.158 19.926 12C19.424 10.846 17.351 7 12 7C6.65201 7 4.57801 10.842 4.07401 12Z"
      fill={color}
    />
  </Svg>
)
