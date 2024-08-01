import { component } from '../lib/component.js'

function Group (props, ...children) {
  return [
    label(props.label),
    ...children
  ]
}

export default component(Group)
