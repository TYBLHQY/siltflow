import React from 'react'
import ReactDOM from 'react-dom/client'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import App from './App.tsx'
// PDF.js official viewer CSS (provides textLayer positioning etc.)
import 'pdfjs-dist/web/pdf_viewer.css'
// react-pdf-highlighter-plus styles (overlays on top of pdfjs)
import 'react-pdf-highlighter-plus/style/style.css'
import 'react-pdf-highlighter-plus/style/pdf_viewer.css'
// Our overrides (last to win)
import './index.css'

// Set PDF.js worker source
const pdfVersion = '4.10.38'
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
