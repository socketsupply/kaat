import { Register } from '../lib/component.js'

function Virtual (props) {
  this.prependCounter = 0
  this.popCounter = 0
  this.shiftCounter = 0
  this.noMoreBottomRows = false
  this.currentVisibleRowIndex = -1
  this.prefetchDirection = null
  this.topIsTruncated = false
  this.bottomIsTruncated = false

  Object.defineProperty(this, 'length', {
    get: function () {
      return this.rows.length
    },
    enumerable: true,
    configurable: true
  })

  /**
   * defaults and their meaning :
   *  - prefetchThreshold, how many pages from bottom or top before
   *      triggering prefetch
   *  - rowsPerPage, how many rows per page to render
   *  - rowPadding, how many rows to render outside visible area
   *  - rowHeight, the height in pixels of each row for computations.
   *  - debug, if enabled will colorize pages.
   */
  props = {
    prefetchThreshold: 2,
    maxRowsLength: 10 * 1000,
    rowsPerPage: 100,
    rowPadding: 50,
    debug: false,
    ...props
  }

  const getRows = () => {
    return this.rows
  }

  const unshiftSOS = () => {
    this.noMoreTopRows = true
    const top = this.querySelector('.x--virtial-top')
    if (top) {
      top.innerHTML = ''
    }
  }

  const = pushEOS = () => {
    this.noMoreBottomRows = true
    const bottom = this.querySelector('.x--virtial-bottom')
    if (bottom) {
      bottom.innerHTML = ''
    }
  }

  this.push = (o) => {
    this.rows = this.rows || []
    this.rows.push(o)
  }

  this.unshift = (o) => {
    this.splice(0, 0, o)
  }

  this.pop = () => {
    this.rows = this.rows || []
    this.rows.pop()
  }

  this.shift = () => {
    this.rows = this.rows || []
    this.rows.shift()
  }

  this.find = (fn) => {
    if (!this.rows) return -1
    return this.rows.find(fn)
  }

  this.findIndex = (fn) => {
    if (!this.rows) return -1
    return this.rows.findIndex(fn)
  }

  this.splice = () => {
    if (!this.rows) return null

    const index = arguments[0]
    const totalItems = arguments.length - 2

    // If index === 0 then the user has not scrolled yet.
    // So do not auto scroll the table. If current visible row
    // is zero then the user just wants to look at the top
    // of the table.
    if (
      index <= this.currentVisibleRowIndex &&
      this.currentVisibleRowIndex !== 0
    ) {
      this.prependCounter += totalItems
      this.currentVisibleRowIndex += totalItems
    }

    return this.rows.splice.apply(this.rows, arguments)
  }

  this.getRow = (idx) => {
    return this.rows[idx]
  }

  this.load = async (rows = []) => {
    this.rows = rows
    this.noMoreBottomRows = false
    this.noMoreTopRows = false
    await this.reRender()

    const inner = this.querySelector('.x--virtial-inner')
    if (inner) {
      inner.innerHTML = ''
    }

    this.pages = {}
    this.initializeRowHeights()
    this.pageHeight = props.rowsPerPage * this.rowHeights[0] // Update this dynamically later
    this.padding = props.rowPadding * this.rowHeights[0] // Update this dynamically later
    this.setInnerHeight()
    return this.rePaint()
  }

  this.initializeRowHeights () => {
    this.rowHeights = this.rows.map((row, index) => {
      const div = document.createElement('div')
      div.innerHTML = this.renderRow(row, index)
      document.body.appendChild(div)
      const height = div.offsetHeight
      document.body.removeChild(div)
      return height
    })

    this.cumulativeHeights = this.rowHeights.reduce((acc, height, index) => {
      acc.push((acc[index - 1] || 0) + height)
      return acc
    }, [])
  }

  this.checkMaxRows = () => {
    const maxRows = props.maxRowsLength
    if (maxRows % props.rowsPerPage !== 0) {
      throw new Error(
        'Invalid maxRowsLength value. Must be multiple of rowsPerPage'
      )
    }

    if (this.rows && this.rows.length > maxRows) {
      const toDelete = this.rows.length - maxRows

      if (this.prefetchDirection === 'bottom') {
        this.rows.splice(0, toDelete)
        this.noMoreTopRows = false
        this.shiftCounter += toDelete

        this.topIsTruncated = true
        this.bottomIsTruncated = false
        if (this.onTopTruncate) {
          this.onTopTruncate()
        }
      } else if (
        this.prefetchDirection === 'top'
      // || this.prefetchDirection === null
      ) {
        this.rows.length = maxRows
        this.noMoreBottomRows = false
        this.popCounter += toDelete

        this.bottomIsTruncated = true
        this.topIsTruncated = false
        if (this.onBottomTruncate) {
          this.onBottomTruncate()
        }
      }
    }
  }

  this.setInnerHeight = () => {
    this.pages = this.pages || {}
    this.pagesAvailable = this.pagesAvailable || []
    const outer = this.querySelector('.x--virtial-outer')
    if (!outer) return

    this.checkMaxRows()
    this.outerHeight = outer.offsetHeight
    this.numPages = Math.ceil(this.rows.length / props.rowsPerPage)

    const inner = this.querySelector('.x--virtial-inner')
    inner.style.height = `${this.cumulativeHeights[this.rows.length - 1]}px`
  }

  this.setHeight = (height, { render } = {}) => {
    const outer = this.querySelector('.x--virtial-outer')
    if (!outer) return

    outer.style.height = height
    this.outerHeight = outer.offsetHeight

    if (render !== false) {
      this.rePaint()
    }
  }

  this.getPage = (i) => {
    let page, state

    if (this.pages[i]) {
      page = this.pages[i]
      state = 'ok'
    } else if (this.pagesAvailable.length) {
      page = this.getAvailablePage()
      state = 'old'
    } else {
      page = this.createNewPage()
      state = 'fresh'
    }

    this.pages[i] = page

    page.style.height = i < this.numPages - 1
      ? `${this.pageHeight}px`
      : this.getLastPageHeight()

    page.style.top = this.getPageTop(i)
    return [page, state]
  }

  this.getAvailablePage = () => {
    const page = this.pagesAvailable.pop()
    const inner = this.querySelector('.x--virtial-inner')
    inner.appendChild(page)
    return page
  }

  /**
   * Logic for scrolling to an offset. This is nuanced because
   * we try to avoid touching `offsetTop` to avoid causing unnecessary
   * repaints or layout calculations.
   *
   * @param {number} offsetId
   */
  this.scrollToId = (offsetId) => {
    const index = this.rows.findIndex(o => o.id === offsetId)
    if (typeof index !== 'number') return
    if (this.rowHeights.length === 0) {
      throw new Error('Cannot call scrollToId() before load()')
    }

    const scrollTop = this.cumulativeHeights[index - 1] || 0

    const outer = this.querySelector('.x--virtial-outer')
    if (!outer) {
      throw new Error('Cannot call scrollToId() in empty or loading state')
    }

    outer.scrollTop = scrollTop
    this.rePaint({ fromScroll: true, scrollTop })
  }

  this.createNewPage = () => {
    const page = document.createElement('div')

    Object.assign(page.style, {
      position: 'absolute',
      minWidth: '100%',
      className: 'x--virtial-page'
    })

    if (props.debug) {
      const random = Math.random() * 356
      page.style.backgroundColor = `hsla(${random}, 100%, 50%, 0.5)`
    }

    const inner = this.querySelector('.x--virtial-inner')
    inner.appendChild(page)
    page.__overflow__ = []
    return page
  }

  this.rePaint = ({ refresh, load, fromScroll, scrollTop } = {}) => {
    if (refresh && load !== false) this.load(this.rows)

    const outer = this.querySelector('.x--virtial-outer')
    if (!outer) return

    this.checkMaxRows()
    const viewStart = typeof scrollTop === 'number' ? scrollTop : outer.scrollTop
    const viewEnd = viewStart + this.outerHeight

    let start = 0
    while (start < this.cumulativeHeights.length && this.cumulativeHeights[start] < viewStart - this.padding) {
      start++
    }

    let end = start
    while (end < this.cumulativeHeights.length && this.cumulativeHeights[end] < viewEnd + this.padding) {
      end++
    }

    start = Math.max(start, 0)
    end = Math.min(end, this.rows.length - 1)

    const pagesRendered = {}

    for (let i = Math.floor(start / props.rowsPerPage); i <= Math.ceil(end / props.rowsPerPage); i++) {
      const [page, state] = this.getPage(i)

      if (state === 'fresh') {
        this.fillPage(i)
      } else if (refresh || state === 'old') {
        if (this.updateRow) {
          this.updatePage(i)
        } else {
          page.innerHTML = ''
          page.__overflow__ = []
          this.fillPage(i)
        }
      }
      pagesRendered[i] = true
    }

    const inner = this.querySelector('.x--virtial-inner')

    for (const pageKey of Object.keys(this.pages)) {
      if (pagesRendered[pageKey]) continue

      this.pagesAvailable.push(this.pages[pageKey])
      inner.removeChild(this.pages[pageKey])
      delete this.pages[pageKey]
    }

    let currentScrollTop = viewStart
    if (this.state.scrollTop && !fromScroll) {
      currentScrollTop = this.state.scrollTop
      outer.scrollTop = this.state.scrollTop
    }

    let shiftHappened = false
    let popHappened = false
    if (
      this.prependCounter > 0 ||
      this.shiftCounter > 0 ||
      this.popCounter > 0
    ) {
      currentScrollTop += this.prependCounter * this.rowHeights[0]
      currentScrollTop -= this.shiftCounter * this.rowHeights[0]
      outer.scrollTop = currentScrollTop
      this.state.scrollTop = currentScrollTop

      if (this.shiftCounter > 0) {
        shiftHappened = true
      }
      if (this.popCounter > 0) {
        popHappened = true
      }

      this.prependCounter = 0
      this.shiftCounter = 0
      this.popCounter = 0
    }

    this.currentVisibleRowIndex = start

    const rowsLength = this.rows ? this.rows.length : 0
    const totalHeight = this.cumulativeHeights[this.rows.length - 1]
    if (
      viewEnd === totalHeight &&
      this.prefetchBottom &&
      this.renderLoadingBottom &&
      !this.noMoreBottomRows
    ) {
      const bottom = this.querySelector('.x--virtial-bottom')
      bottom.innerHTML = this.renderLoadingBottom()
    }

    if (
      rowsLength === props.maxRowsLength &&
      viewStart === 0 &&
      this.prefetchTop &&
      this.renderLoadingTop &&
      !this.noMoreTopRows
    ) {
      const top = this.querySelector('.x--virtial-top')
      top.innerHTML = this.renderLoadingTop()
    }

    if (!popHappened && (
      rowsLength === props.maxRowsLength &&
      start <= props.prefetchThreshold
    )) {
      if (!this.noMoreTopRows && this.prefetchTop) {
        this.prefetchDirection = 'top'
        this.prefetchTop()
      }
    }

    if (!shiftHappened && (
      end >= this.numPages - props.prefetchThreshold
    )) {
      if (!this.noMoreBottomRows && this.prefetchBottom) {
        this.prefetchDirection = 'bottom'
        this.prefetchBottom()
      }
    }
  }

  this.getPageTop = (i) => {
    const startIndex = i * props.rowsPerPage
    return `${this.cumulativeHeights[startIndex - 1] || 0}px`
  }

  this.getLastPageHeight = () => {
    const lastPageIndex = Math.floor(this.rows.length / props.rowsPerPage)
    const lastPageStart = lastPageIndex * props.rowsPerPage
    const lastPageEnd = this.rows.length
    return `${this.cumulativeHeights[lastPageEnd - 1] - (this.cumulativeHeights[lastPageStart - 1] || 0)}px`
  }

  this.fillPage = (i) => {
    const page = this.pages[i]
    const frag = document.createDocumentFragment()
    const limit = Math.min((i + 1) * props.rowsPerPage, this.rows.length)

    for (let j = i * props.rowsPerPage; j < limit; j++) {
      const data = this.getRow(j)
      if (!data) continue

      const div = document.createElement('div')
      div.innerHTML = this.renderRow(data, j)
      frag.appendChild(div.firstElementChild)
    }

    page.appendChild(frag)
  }

  this.updatePage = (i) => {
    const page = this.pages[i]
    const start = i * parseInt(props.rowsPerPage, 10)

    const rowsLength = this.rows ? this.rows.length : 0
    const limit = Math.min((i + 1) * props.rowsPerPage, rowsLength)

    const inner = this.querySelector('.x--virtial-inner')

    if (start > limit) {
      inner.removeChild(page)
      delete this.pages[i]
      return
    }

    for (let j = start, rowIdx = 0; j < limit; j++, rowIdx++) {
      if (page.children[rowIdx] && this.updateRow) {
        this.updateRow(this.getRow(j), j, page.children[rowIdx])
      } else if (page.__overflow__.length > 0 && this.updateRow) {
        const child = page.__overflow__.shift()
        this.updateRow(this.getRow(j), j, child)
        page.appendChild(child)
      } else {
        const div = document.createElement('div')
        div.innerHTML = this.renderRow(this.getRow(j), j)
        page.appendChild(div.firstElementChild)
      }
    }

    while (page.children.length > limit - start) {
      const child = page.lastChild
      page.__overflow__.push(child)
      page.removeChild(child)
    }
  }

  this.on('connected', () => {
    if (!props.data || !props.data.length) return
    this.load(props.data)
  })

  this.on('updated', () => {
    const outer = this.querySelector('.x--virtial-outer')

    if (outer && outer.__hasWindowedScrollListener) return
    if (outer) {
      outer.addEventListener('scroll', () => {
        const scrollTop = this.state.scrollTop = outer.scrollTop
        this.rePaint({ fromScroll: true, scrollTop })
      }, { passive: true })
      outer.__hasWindowedScrollListener = true
    }
  })

  renderLoadingState () {
    return div({ class: 'x--virtial-loader' })
  }

  renderEmptyState () {
    return div({ class: 'x--virtial-empty' })
  }

  if (!this.rows) {
    return this.renderLoadingState()
  }

  if (!this.rows.length) {
    return this.renderEmptyState()
  }

  return (
    div({ class: 'x--virtial-outer', style: { width: '100%', height: 'inherit', overflow: 'auto' } },
      div({ class: 'x--virtial-headers', style: { position: 'sticky', zIndex: 1, top: 0 }),
      div({ class: 'x--virtial-top', style: { position: 'relative' }),
      div({ class: 'x--virtial-inner', style: { position: 'relative' } }),
      div({ class: 'x--virtial-bottom', style: { position: 'relative' } })
    )
  )
}

Virtual = Register(Virtual)
