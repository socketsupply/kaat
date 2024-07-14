import { register } from '../lib/component.js'

function Switch (props) {
  return label(
    input({ type: 'checkbox', switch: true }),
    props.label
  )
}

export default register(Switch)
