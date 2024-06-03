/**
 *
 * A simple React-like component system using plain JavaScript. No compilers. <80 LoC.
 *
 * Notes:
 *   - JSX-like syntax but no DSL, plain old JS.
 *   - async/await "just works", no weird use functions.
 *   - Empty root is weird, allow components to return arrays.
 *   - Anything returned is appended to the root.
 *   - No esscape opportunities from big template literals.
 *   - Insde the component, 'this' is the dom element.
 *
 * Usage:
 *
 * ```js
 * async function Counter (props, ...children) {
 *   this.addEventListener('ready', e => {
 *     // ...this component is ready
 *   })
 *
 *   await sleep(200) // do something async if you want
 *
 *   return (
 *     div({ style: { border: '1px solid blue' } },
 *       span('counter=', b(props.value), '!')
 *     )
 *   )
 * }
 *
 * Counter = Register(Counter) // The catch is, you need to register your components.
 *
 * async function App () {
 *   let count = 0
 *
 *   const click = (event, match) => {
 *     if (!match('#foo')) return
 *
 *     event.target.render({ value: String(++count) })
 *   }
 *
 *   return (
 *     div({ style: { border: '1px solid red', fontFamily: 'monospace', cursor: 'pointer' } },
 *       await Counter({ id: 'foo', value: '0' }),
 *       click,
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
const match = el => s => {
  if (!el.matches) el = el.parentElement
  return el.matches(s) ? el : el.closest(s)
}

/**
 * Creates an HTML element or uses an existing element.
 * @param {string|Function} t - The tag name or component function.
 * @param {...*} args - The arguments to pass to the element or component.
 * @returns {HTMLElement} - The created or updated HTML element.
 */
const createElement = (t, ...args) => {
  if (t === 'svg' || t === 'use') {
    t = document.createElementNS('http://www.w3.org/2000/svg', t)
  }

  const el = typeof t === 'string' ? document.createElement(t) : t

  args.flat().forEach(c => {
    if (typeof c === 'string') {
      el.appendChild(document.createTextNode(c))
    } else if (c instanceof globalThis.Node) {
      el.appendChild(c)
      c.dispatchEvent(new CustomEvent('ready', { detail: { element: c } }))
    } else if (typeof c === 'function') {
      el.addEventListener(c.name, e => c(e, match(e.target)))
    } else if (typeof c === 'object' && c !== null) {
      Object.entries(c).forEach(([k, v]) => {
        if (typeof v === 'function') { // allow listeners here to, why not
          el.addEventListener(v.name, e => v(e, match(e.target)))
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v)
        } else if (k === 'class') {
          if (el.tagName === 'svg') el.setAttribute('class', v)
          else el.className = v
        } else if (k === 'data') {
          el.dataset[k] = v
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
for (const tag of tags) {
  globalThis[tag] = (...args) => createElement(tag, ...args)
}

/**
 * Registers a component function.
 * @param {Function} Fn - The component function to register.
 * @returns {Function} - The registered component function wrapped in a Proxy.
 */
/**
 * Registers a component function.
 * @param {Function} Fn - The component function to register.
 * @returns {Function} - The registered component function wrapped in a Proxy.
 */
export function Register (...args) {
  const register = Fn => {
    /* eslint-disable no-new-func */
    globalThis[Fn.name] = new Proxy(Fn, {
      /**
       * Handles the application of the component function.
       * @param {Function} target - The original component function.
       * @param {Object} self - The value of `this` provided for the call to `target`.
       * @param {Array} argumentsList - The list of arguments for the call to `target`.
       * @returns {Promise<HTMLElement>} - The created HTML element.
       */
      apply: async (target, self, argumentsList) => {
        const el = createElement(Fn.name, ...argumentsList)
        /**
         * Renders the component with updated properties.
         * @param {...*} args - The updated properties.
         */
        el.render = async (...args) => {
          el.innerHTML = ''
          const props = { ...argumentsList[0], ...args[0] }
          const children = args.flat().filter(a => a instanceof globalThis.Node)
          const tree = await Reflect.apply(target, el, [props, ...children])
          if (tree) [tree].flat().forEach(node => el.appendChild(node))
        }

        const tree = await Reflect.apply(target, el, argumentsList)
        if (tree) [tree].flat().forEach(node => el.appendChild(node)) // allow arrays

        return el
      }
    })

    return globalThis[Fn.name]
  }

  if (args.length > 1) return args.map(register)
  return register(args[0])
}

/**
 * Creates the root component and appends it to the specified element.
 * @param {Function} fn - The root component function.
 * @param {HTMLElement} el - The element to append the root component to.
 * @returns {Promise<void>}
 */
export async function createRoot (fn, el) {
  const c = Register(fn)
  let root

  try {
    root = await c()
  } catch (err) {
    throw err
  }

  el.appendChild(root)
}
