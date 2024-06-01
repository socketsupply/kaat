import process from 'socket:process'

const view = {}

view.init = async ({ views }) => {
  const coMessages = document.getElementById('messages')
  const elSidebarToggle = document.getElementById('sidebar-toggle')

  // sidebar toggle is fixed position, so give it its own listener
  elSidebarToggle.addEventListener('click', e => {
    if (elSidebarToggle.getAttribute('open') === 'true') {
      views.messages.springView.updateTransform()
      views.messages.springView.start(0)
      elSidebarToggle.setAttribute('open', 'false')
    } else {
      views.messages.springView.start(280)
      elSidebarToggle.setAttribute('open', 'true')
    }
  })
}

export { view as sidebar }
