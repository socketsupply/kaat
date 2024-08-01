import { component } from '../lib/component.js'

function Button(props) {
  this.setAttribute('type', props.type || 'default')
  Object.assign(this, props)
}

export default component(Button)
