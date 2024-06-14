/**
 *
 * A simple React-like component system using plain JavaScript.
 *
 * Notes:
 *   - Absolutely no build step required
 *   - No DSLs. JSX-like syntax, but 100% JavaScript semantics
 *   - The same lifecycle events as web components
 *   - Components can be async/await, even async generators
 *   - Components return arrays or trees of dom nodes
 *   - Props are a zero cost abstraction
 *   - Insde the component, 'this' is the dom element.
 *
 * Usage:
 *
 * ```js
 * function CounterA (props, ...children) {
 *   this.state.count ??= 0
 *
 *   const onclick = () => {
 *     this.state.count++
 *   }
 *
 *   return div(`count=${this.state.count}`, onclick)
 * }
 *
 * CounterA = Register(CounterA)
 *
 * async function CounterB (props, ...children) {
 *   await sleep(16) // do something async if you want
 *
 *   return (
 *     div({ style: { border: '1px solid blue' } },
 *       span('counter=', b(props.value), '!')
 *     )
 *   )
 * }
 *
 * CounterB = Register(CounterB)
 *
 * async function App () {
 *   let count = 0
 *
 *   const onclick = (event, match) => {
 *     if (!match('#b')) return
 *
 *     event.target.render({ value: String(++count) }) // you can manually render with new props
 *   }
 *
 *   return (
 *     div({ style: { border: '1px solid red', fontFamily: 'monospace', cursor: 'pointer' } },
 *       CounterA({ id: 'a' }),
 *       await CounterB({ id: 'b', value: '0' }),
 *       onclick,
 *     )
 *   )
 * }
 *
 * createRoot(App, document.body)
 * ```
 */

/**
 * List of HTML tags.
 * @type {string[]}
 */
const tags = 'a,abbr,address,area,article,aside,audio,b,base,bdi,bdo,blockquote,body,br,button,canvas,caption,cite,code,col,colgroup,data,datalist,dd,del,details,dfn,dialog,div,dl,dt,em,embed,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hr,html,i,iframe,img,input,ins,kbd,label,legend,li,link,main,map,mark,meta,meter,nav,noscript,object,ol,optgroup,option,output,p,param,picture,pre,progress,q,rp,rt,ruby,s,samp,script,section,select,small,source,span,strong,style,sub,summary,sup,svg,table,tbody,td,template,textarea,tfoot,th,thead,time,title,tr,track,u,ul,use,video,wbr'.split(',')

/**
 * Matches an element to a selector.
 * @param {HTMLElement} el - The element to match.
 * @returns {Function} - A function that takes a selector string and returns the matching element or its closest ancestor.
 */
const match = el => s => (el.matches ? el : el.parentElement).closest(s)

/**
 * Creates an HTML element or uses an existing element.
 * @param {string|Function} t - The tag name or component function.
 * @param {...*} args - The arguments to pass to the element or component.
 * @returns {HTMLElement} - The created or updated HTML element.
 */
const createElement = (t, ...args) => {
  if (['svg', 'use'].includes(t)) {
    t = document.createElementNS('http://www.w3.org/2000/svg', t)
  }

  const el = typeof t === 'string' ? document.createElement(t) : t

  args.flat().forEach(c => {
    if (typeof c === 'string') {
      el.appendChild(document.createTextNode(c))
    } else if (c instanceof globalThis.Node) {
      el.appendChild(c)
    } else if (typeof c === 'function' && c.name ) {
      const eventName = c.name.slice(2).toLowerCase()
      el.addEventListener(eventName, e => c(e, match(e.target)))
    } else if (typeof c === 'object' && c !== null) {
      Object.entries(c).forEach(([k, v]) => {
        if (typeof v === 'function') { // allow listeners here to, why not
          const eventName = v.name.slice(2).toLowerCase()
          el.addEventListener(eventName, e => v(e, match(e.target)))
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v)
        } else if (k === 'class') {
          if (el.tagName === 'svg') {
            el.setAttribute('class', v)
          } else {
            el.className = v
          }
        } else if (k === 'data') {
          Object.entries(v).forEach(a => el.dataset[a[0]] = a[1])
        } else if (el.tagName === 'use' || k === 'contenteditable') {
          if (k.includes('xlink')) {
            el.setAttributeNS('http://www.w3.org/1999/xlink', k, v);
          } else {
            el.setAttribute(k, v)
          }
        } else if (k in el) {
          el[k] = v
        }
      })
    }
  })

  return el
}

/**
 * A collection of functions to create HTML elements.
 * @type {Object<string, Function>}
 */
for (const tag of tags) globalThis[tag] = (...args) => createElement(tag, ...args)

const observables = []

/**
 * Registers a component function.
 * @param {Function} Fn - The component function to register.
 * @returns {Function} - The registered component function wrapped in a Proxy.
 */
export function Register (Fn) {
  const collect = (el, tree) => [tree].flat().forEach(node => el.appendChild(node))
  const hyphenate = (name) => name.match(/[A-Z][a-z0-9]*/g).join('-').toLowerCase()
  const children = (args) => args.flat().filter(a => a instanceof globalThis.Node)

  globalThis[Fn.name] = new Proxy(Fn, {
    /**
     * Handles the application of the component function.
     * @param {Function} target - The original component function.
     * @param {Object} self - The value of `this` provided for the call to `target`.
     * @param {Array} argumentsList - The list of arguments for the call to `target`.
     * @returns {Promise<HTMLElement>} - The created HTML element.
     */
    apply: (target, self, args) => {
      const el = createElement(hyphenate(Fn.name), ...args)
      const id = args[0]?.id || el.id || Fn.name
      if (!Register.state[id]) Register.state[id] = {}
      el.state = new Proxy(Register.state[id], { // re-render when state is updated.
        set (target, property, value) {
          let isUpdate = false
          if (property in target) isUpdate = true
          target[property] = value

          if (isUpdate) {
            clearTimeout(isUpdate)
            isUpdate = setTimeout(() => el.render())
          }
          return true
        }
      })

      el.on = (s, fn) => {
        const listener = e => fn.apply(el, [e, match(e.target)])
        el.addEventListener(s, listener)
        return listener
      }

      el.off = (s, fn) => el.removeEventListener(s, fn)
      el.emit = (s, detail) => el.dispatchEvent(new CustomEvent(eventName, { detail }))

      function apply (args) {
        let result

        try {
          result = target.apply(el, args)
        } catch (err) { throw err }

        if (result?.constructor.name === 'Promise') {
          result.then(res => collect(el, res)).catch(err => { throw err })
        } else if (result) {
          collect(el, result)
        }
        el.dispatchEvent(new CustomEvent('updated', { detail: { element: el } }))
      }

      el.render = (updates) => {
        el.innerHTML = ''
        apply([{ ...args[0], ...updates }, ...children(args)])
      }

      apply(args)

      observables.push(el)
      return el
    }
  })

  return globalThis[Fn.name]
}

Register.state = {}

/**
 * Creates the root component and appends it to the specified element.
 * @param {Function} fn - The root component function.
 * @param {HTMLElement} el - The element to append the root component to.
 * @returns {Promise<void>}
 */
export async function createRoot (Fn, el) {
  const fn = Register(Fn)
  let root

  try {
    root = await fn()
    el.appendChild(root)
  } catch (err) {
    throw err
  }

  const processNodes = (nodes, eventType) => {
    for (const node of nodes) {
      const index = observables.findIndex(el => el === node)
      if (index == -1) continue

      const el = observables[index]
      el.dispatchEvent(new CustomEvent(eventType, { detail: { element: el } }))
      if (eventType === 'disconnected') observables.splice(index, 1)
    }
  }

  const observer = new MutationObserver(list => {
    list.forEach(mut => {
      if (mut.removedNodes) processNodes(mut.removedNodes, 'disconnected')
      if (mut.addedNodes) processNodes(mut.addedNodes, 'connected')
    })
  })

  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeOldValue: true })
}
