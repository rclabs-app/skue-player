import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Custom directive for PC users to scroll horizontal lists with vertical mouse wheel
app.directive('horizontal-scroll', {
  mounted(el: HTMLElement) {
    el.addEventListener('wheel', (e: WheelEvent) => {
      // If we are scrolling vertically and not horizontally
      if (e.deltaY !== 0 && e.deltaX === 0) {
        // Only prevent default if we can actually scroll
        const maxScrollLeft = el.scrollWidth - el.clientWidth
        if ((e.deltaY > 0 && el.scrollLeft < maxScrollLeft) || (e.deltaY < 0 && el.scrollLeft > 0)) {
          e.preventDefault()
          el.scrollBy({ left: e.deltaY > 0 ? 300 : -300, behavior: 'smooth' })
        }
      }
    })
  }
})

app.mount('#app')
