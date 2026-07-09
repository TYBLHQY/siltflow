import React from 'react'
import ReactDOM from 'react-dom/client'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import App from './App.tsx'
import './index.css'
import 'react-pdf-highlighter-plus/style/style.css'
import 'react-pdf-highlighter-plus/style/pdf_viewer.css'

// Set PDF.js worker source
const pdfVersion = '4.10.38'
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
