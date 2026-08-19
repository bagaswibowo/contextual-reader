import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { ThemeProvider } from './hooks/useTheme'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--color-card)',
              color: 'var(--color-text)',
              border: '2px solid var(--color-border)',
              borderRadius: '16px',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: '600',
            },
            success: {
              iconTheme: {
                primary: '#58CC02',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#FF4B4B',
                secondary: '#fff',
              },
            },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)