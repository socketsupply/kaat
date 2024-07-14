import { register } from '../lib/component.js'

const T_YEARS = 1000 * 60 * 60 * 24 * 365
const T_MONTHS = 1000 * 60 * 60 * 24 * 30
const T_WEEKS = 1000 * 60 * 60 * 24 * 7
const T_DAYS = 1000 * 60 * 60 * 24
const T_HOURS = 1000 * 60 * 60
const T_MINUTES = 1000 * 60
const T_SECONDS = 1000

function RelativeTime (props) {
  function calculate () {
    const ts = props.timestamp
    const t = Math.abs(ts - new Date().getTime())
    const toString = i => String(parseInt(i, 10))

    if (t >= T_YEARS) {
      return { value: `${toString(t / T_YEARS)}y` }
    } else if (t >= T_MONTHS) {
      return { value: `${toString(t / T_MONTHS)}m` }
    } else if (t >= T_WEEKS) {
      return { value: `${toString(t / T_WEEKS)}w` }
    } else if (t >= T_DAYS) {
      return { value: `${toString(t / T_DAYS)}d` }
    } else if (t >= T_HOURS) {
      return { value: `${toString(t / T_HOURS)}h` }
    } else if (t >= T_MINUTES) {
      return { value: `${toString(t / T_MINUTES)}m`, timer: true }
    }
    return { value: `${toString(t / T_SECONDS)}s`, timer: true }
  }

  let updates = 256
  const o = calculate()
  const timer = setInterval(() => {
    if (--updates === 0) return clearInterval(timer)
    const o = calculate()
    this.textContent = o.value
  }, 1000)

  this.clear = () => {
    clearInterval(timer)
  }

  this.textContent = o.value
}

export default register(RelativeTime)
