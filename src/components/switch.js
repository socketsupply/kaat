import { Register } from '../lib/component.js'

function Switch (props) {
  return label(
    input({ type: 'checkbox', switch: true }),
    props.label
  )
}

Switch = Register(Switch)
export { Switch } 
