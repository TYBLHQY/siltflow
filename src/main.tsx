import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'react-pdf-highlighter-plus/style/style.css'
import 'react-pdf-highlighter-plus/style/pdf_viewer.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
