import { Register } from '../lib/component.js'

function Group (props, ...children) {
  return [
    label(props.label),
    ...children
  ]
}

Group = Register(Group)
export { Group } 
