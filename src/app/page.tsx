'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { FiUpload, FiSend, FiSun, FiMoon, FiDownload, FiTrendingUp } from 'react-icons/fi'
import { useDropzone } from 'react-dropzone'
import toast, { Toaster } from 'react-hot-toast'
import { BsRobot, BsPerson } from 'react-icons/bs'

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [dark, setDark] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [jobDesc, setJobDesc] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme')
    if (storedTheme === 'dark') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newTheme = !dark
    setDark(newTheme)
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', newTheme)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: accepted => {
      if (!accepted[0]?.type.includes('pdf')) {
        toast.error('❌ Please upload a PDF file.')
        return
      }
      setFile(accepted[0])
    }
  })

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const greeting = response.data?.message || '✅ Resume uploaded! Ask me anything about it.'
      setUploaded(true)
      setMessages([{ role: 'assistant', content: greeting }])
      setScore(null)
    } catch {
      setMessages([{ role: 'assistant', content: '❌ Upload failed. Please try again.' }])
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !uploaded) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const text = line.replace('data: ', '')
            for (const char of text) {
              assistantMessage += char
              await new Promise(res => setTimeout(res, 8))
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1].content = assistantMessage
                return updated
              })
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Failed to fetch response.' }])
    } finally {
      setIsStreaming(false)
    }
  }

  const downloadChat = () => {
    const content = messages.map(m => `${m.role === 'user' ? '🧑 You' : '🤖 Assistant'}:\n${m.content}\n\n`).join('')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'resume-chat-history.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('✅ Chat downloaded successfully!')
  }

  const handleRoleFitCheck = async () => {
    if (!jobDesc.trim()) {
      toast.error(' Please enter a job description first📝')
      return
    }
    try {
      const res = await axios.post('http://localhost:8000/score', { job_description: jobDesc })
      const { score } = res.data
      setScore(score)
      toast.success(`🎯 Role-fit Score: ${score}%`)
    } catch {
      toast.error('⚠️ Failed to calculate role-fit score.')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-black px-4 py-8 md:px-8 text-gray-800 dark:text-gray-100 transition-colors">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto relative">
        <h1 className="text-4xl font-bold text-center mb-10">Resume Chat Assistant</h1>

        

        {!uploaded && (
          <section className="mb-10">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition duration-300 ${
                isDragActive ? 'border-blue-400 bg-blue-100 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
              }`}
            >
              <input {...getInputProps()} />
              <FiUpload className="mx-auto text-5xl mb-3 text-blue-400" />
              <p className="text-gray-600 dark:text-gray-300">
                {file ? file.name : isDragActive ? 'Drop your resume here...' : 'Drag and drop your PDF resume or click to upload.'}
              </p>
            </div>
            {file && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl text-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Resume'}
              </button>
            )}
          </section>
        )}

        <section className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-6 h-[600px] flex flex-col border border-gray-100 dark:border-gray-700">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <BsRobot className="text-2xl text-blue-500" title="Assistant" />}
                {msg.role === 'user' && <BsPerson className="text-2xl text-gray-400" title="You" />}
                <div className={`rounded-xl px-4 py-3 max-w-[80%] text-sm shadow ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={!uploaded || isStreaming}
              placeholder="Ask your resume anything..."
              className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50"
              title="Send message"
            >
              <FiSend className="text-xl" />
            </button>
            <button
              type="button"
              onClick={downloadChat}
              disabled={messages.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50"
              title="Download chat"
            >
              <FiDownload className="text-xl" />
            </button>
            <button
              type="button"
              onClick={handleRoleFitCheck}
              className="bg-yellow-500 text-white px-4 py-2 rounded-xl hover:bg-yellow-600"
              title="Check role-fit score"
            >
              <FiTrendingUp className="text-xl" />
            </button>
          </form>

          {score !== null && (
            <div className="text-center mt-3 text-sm text-yellow-500">
              🎯 Role-fit score: <strong>{score}%</strong>
            </div>
          )}

          <textarea
            value={jobDesc}
            onChange={e => setJobDesc(e.target.value)}
            rows={3}
            placeholder="Paste the job description here for better scoring..."
            className="mt-4 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 p-3"
          />
        </section>
      </div>
    </main>
  )
}
