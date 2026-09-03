import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { authReady } from './lib/auth'
import './assets/main.css'

const app = createApp(App)

app.use(router)

// Mount only after the stored session has been read back, so a signed-in user
// reloading the page never sees the login screen flash first. authReady never
// rejects — an unreadable store resolves as signed out.
authReady.then(() => {
  app.mount('#app')
})
