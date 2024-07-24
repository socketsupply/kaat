/**
 *
 * A simple, single-file React-like component system.
 *
 * - JSX-like syntax, but 100% JS. No build step. No DSLs.
 * - Works in any JavaScript environment (does SSR).
 * - Web-component-like lifecycle events.
 * - Components can be async/await, even async generators.
 * - Components can return arrays or trees of dom nodes.
 * - Enforce React's one component export per file rule.
 * - Enforce React style component grouping/namespacing.
 * - Insde the component, 'this' is the dom element.
 *
 */

/**
 * @typedef {('a'|'abbr'|'address'|'area'|'article'|'aside'|'audio'|'b'|'base'|'bdi'|'bdo'|'blockquote'|'body'|'br'|'button'|'canvas'|'caption'|'cite'|'code'|'col'|'colgroup'|'data'|'datalist'|'dd'|'del'|'details'|'dfn'|'dialog'|'div'|'dl'|'dt'|'em'|'embed'|'fieldset'|'figcaption'|'figure'|'footer'|'form'|'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'head'|'header'|'hr'|'html'|'i'|'iframe'|'img'|'input'|'ins'|'kbd'|'label'|'legend'|'li'|'link'|'main'|'map'|'mark'|'meta'|'meter'|'nav'|'noscript'|'object'|'ol'|'optgroup'|'option'|'output'|'p'|'param'|'picture'|'pre'|'progress'|'q'|'rp'|'rt'|'ruby'|'s'|'samp'|'script'|'section'|'select'|'small'|'source'|'span'|'strong'|'style'|'sub'|'summary'|'sup'|'svg'|'table'|'tbody'|'td'|'template'|'textarea'|'tfoot'|'th'|'thead'|'time'|'title'|'tr'|'track'|'u'|'ul'|'use'|'video'|'wbr')} HTMLTag
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
 * Provides SSR by implementing the dom methods that are missing outside the browser.
 */
if (!globalThis.document) {
  globalThis.Node = class Node {
    children = []
    parentRef = null
    constructor (_type) {
      this._type = _type
      this.attributes = {}
    }

    set className (s) {
      this.attributes.class = s
    }

    get innerHTML () {
      return this.children.map(child => child.toString(1)).join('')
    }

    appendChild (node) {
      this.children.push(node)
    }

    setAttribute (key, value) {
      this.attributes[key] = value
    }

    setAttributeNS (_, key, value) {
      this.attributes[key] = value
    }

    addEventListener () {}
    toString (indentationLevel = 0) {
      if (this._type === '#text') return this.attributes.text

      const indent = indentationLevel === 0 ? '' : '  '.repeat(indentationLevel)
      const attributes = Object.entries(this.attributes).map(([key, value]) => `${key}="${value}"`).join(' ')

      const children = this.children.map(child => child.toString(indentationLevel + 1)).join('\n')
      const hasElementChildren = this.children.some(child => child._type !== '#text')

      if (hasElementChildren) {
        return `${indent}<${this._type}${attributes ? ' ' + attributes : ''}>\n${children}\n${indent}</${this._type}>`
      }

      const childrenText = this.children.map(child => child.toString(indentationLevel)).join('')
      return `${indent}<${this._type}${attributes ? ' ' + attributes : ''}>${childrenText}</${this._type}>`
    }
  }

  const propHandler = {
    set (target, property, value) {
      if (property in target) {
        target[property] = value
      } else {
        target.attributes[property] = value
      }
      return true
    }
  }

  globalThis.document = {
    createElementNS: (ns, t) => new Proxy(new globalThis.Node(t), propHandler),
    createElement: t => new Proxy(new globalThis.Node(t), propHandler),
    createTextNode: text => {
      const node = new globalThis.Node('#text')
      node.attributes.text = text
      return node
    }
  }
}

/**
 * Creates an HTML element or uses an existing element.
 * @param {string|Function} t - The tag name or component function.
 * @param {...*} args - The arguments to pass to the element or component.
 * @returns {HTMLElement} - The created or updated HTML element.
 */
const createElement = (t, ...args) => {
  if (['svg', 'use'].includes(t)) {
    t = globalThis.document.createElementNS('http://www.w3.org/2000/svg', t)
  }

  const el = typeof t === 'string' ? globalThis.document.createElement(t) : t

  args.flat().forEach(c => {
    if (typeof c === 'string') {
      el.appendChild(globalThis.document.createTextNode(c))
    } else if (c instanceof globalThis.Node) {
      if (c.parentRef) {
        const i = c.parentRef.children.findIndex(node => node === c)
        c.parentRef.children.splice(i, 1)
      }
      if (!globalThis.window) c.parentRef = el // emulate move semantics
      el.appendChild(c)
    } else if (typeof c === 'function' && c.name) {
      const eventName = c.name.slice(2).toLowerCase()
      el.addEventListener(eventName, e => c(e, match(e.target)))
    } else if (typeof c === 'object' && c !== null) {
      Object.entries(c).forEach(([k, v]) => {
        if (typeof v === 'function') {
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
          Object.entries(v).forEach(a => (el.dataset[a[0]] = a[1]))
        } else if (el.tagName === 'use' || k === 'contenteditable') {
          if (k.includes('xlink')) {
            el.setAttributeNS('http://www.w3.org/1999/xlink', k, v)
          } else {
            el.setAttribute(k, v)
          }
        } else if (k in el || !globalThis.window) {
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
 * @param {Object} obj - An object of components to register.
 * @returns {function}
 */
export function register (Fn) {
  const collect = (el, tree) => [tree].flat().forEach(node => el.appendChild(node))
  const hyphenate = (name) => (name.match(/[A-Z][a-z0-9]*/g)?.join('-') ?? name).toLowerCase()
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
      if (!register.state[id]) register.state[id] = {}

      if (globalThis.window) {
        el.render = (updates) => {
          el.innerHTML = ''
          apply([{ ...args[0], ...updates }, ...children(args)])
        }

        el.state = new Proxy(register.state[id], { // re-render when state is updated.
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
        el.emit = (s, detail) => el.dispatchEvent(new CustomEvent(s, { detail }))

        observables.push(el)
      }

      function apply (args) {
        const result = target.apply(el, args)

        if (result?.constructor.name === 'Promise') {
          result.then(res => collect(el, res)).catch(err => { throw err })
        } else if (result) {
          collect(el, result)
        }
        el.dispatchEvent?.(new CustomEvent('updated', { detail: { element: el } }))
      }

      apply(args)

      return el
    }
  })

  return globalThis[Fn.name]
}

register.state = {}

/**
 * Creates the root component and appends it to the specified element.
 * @param {Function} App - The root component function.
 * @param {HTMLElement} el - The element to append the root component to.
 * @returns {Promise<void>}
 */
export async function createRoot (App, el) {
  const app = register(App)
  let root

  try {
    root = await app()
  } catch (err) {
    throw new Error(err.message)
  }

  if (el) {
    el.appendChild(root)
  } else {
    el = document.querySelector(App.name)

    if (el) {
      el.parentNode.replaceChild(root, el)
    } else {
      document.body.appendChild(root)
    }
  }

  if (globalThis.MutationObserver) {
    const processNodes = (nodes, eventType) => {
      for (const node of nodes) {
        const index = observables.findIndex(el => el === node)
        if (index === -1) continue

        const el = observables[index]
        el.dispatchEvent(new CustomEvent(eventType, { detail: { element: el } }))
        if (eventType === 'destroyed') observables.splice(index, 1)
      }
    }

    const observer = new globalThis.MutationObserver(list => {
      list.forEach(mut => {
        if (mut.removedNodes) processNodes(mut.removedNodes, 'destroyed')
        if (mut.addedNodes) processNodes(mut.addedNodes, 'ready')
      })
    })

    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeOldValue: true })
  }
}
