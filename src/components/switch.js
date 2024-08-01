import { component } from '../lib/component.js'

function Switch (props) {
  return label(
    input({ type: 'checkbox', switch: true }),
    props.label
  )
}

export default component(Switch)
