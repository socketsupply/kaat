import { Register } from '../lib/component.js'

function Button(props) {
  this.setAttribute('type', props.type || 'default')
  Object.assign(this, props)
}

Button = Register(Button)
export { Button } 
