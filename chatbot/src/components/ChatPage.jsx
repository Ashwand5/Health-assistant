import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  ChevronLeft,
  Send,
  Lightbulb,
  Mic,
  Upload,
  Bot,
  User,
  Trash2,
  FileText,
  Image,
  Music,
  LogOut,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';

const suggestions = [
  "Explain my symptoms",
  "Analyze my medical report",
  "Track my health metrics",
  "Provide health tips",
];

function ChatPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useUser();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      type: 'assistant',
      content: "<p>Hello! I'm MediChat AI, your personal health assistant. How can I assist you today?</p>",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [file, setFile] = useState(null);
  const [chatHeight, setChatHeight] = useState('auto');
  const [showFileTypeMenu, setShowFileTypeMenu] = useState(false);
  const [reportProcessed, setReportProcessed] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatAreaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const updateChatHeight = () => {
      const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 0;
      const suggestionsHeight = document.querySelector('.row.g-3.mb-3')?.offsetHeight || 0;
      const inputHeight = document.querySelector('.bg-white.rounded-3.shadow-lg.p-3.border')?.offsetHeight || 0;
      const containerPadding = 48;
      const totalHeight = navbarHeight + suggestionsHeight + inputHeight + containerPadding;
      setChatHeight(`calc(100vh - ${totalHeight}px)`);
    };

    updateChatHeight();
    window.addEventListener('resize', updateChatHeight);
    return () => window.removeEventListener('resize', updateChatHeight);
  }, []);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFileTypeMenu && !event.target.closest('.file-type-menu') && !event.target.closest('.upload-btn')) {
        setShowFileTypeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFileTypeMenu]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setFile(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: '<p class="text-center">Recording started...</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error) {
      console.error('Error starting recording:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: '<p>Failed to start recording. Please allow microphone access.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: '<p class="text-center">Recording stopped.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleFileTypeSelect = (type) => {
    setShowFileTypeMenu(false);
    let acceptType;
    switch (type) {
      case 'pdf':
        acceptType = 'application/pdf';
        break;
      case 'image':
        acceptType = 'image/jpeg,image/png,image/gif';
        break;
      case 'audio':
        acceptType = 'audio/wav,audio/mpeg';
        break;
      default:
        return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('accept', acceptType);
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    const fileType = uploadedFile.type;
    const validAudioTypes = ['audio/wav', 'audio/mpeg'];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const validPdfTypes = ['application/pdf'];

    if (
      validAudioTypes.includes(fileType) ||
      validImageTypes.includes(fileType) ||
      validPdfTypes.includes(fileType)
    ) {
      setFile(uploadedFile);
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          content: `<p class="text-center">${getFileTypeLabel(fileType)} uploaded: ${uploadedFile.name}</p>`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: '<p>Please upload a valid file for the selected type.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const getFileTypeLabel = (fileType) => {
    if (fileType.startsWith('audio/')) return 'Audio file';
    if (fileType.startsWith('image/')) return 'Image';
    if (fileType === 'application/pdf') return 'PDF';
    return 'File';
  };

  const handleSendFile = async () => {
    if (!file) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: '<p>Please upload a file first.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    const fileType = file.type;
    let userMessageContent;
    if (fileType.startsWith('audio/')) {
      userMessageContent = '<p>🎙️ Audio message sent</p>';
    } else if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      userMessageContent = `<p>${fileType.startsWith('image/') ? '🖼️ Image' : '📄 PDF'} sent for analysis</p>`;
      setReportProcessed(fileType.startsWith('image/') || fileType === 'application/pdf');
    }

    setMessages((prev) => [
      ...prev,
      {
        type: 'user',
        content: userMessageContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:5000/api/upload-medical-report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      setIsTyping(false);

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: data.summary || data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          {
            type: 'assistant',
            content: '<p>Please ask any questions about your medical report!</p>',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setFile(null);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: `<p>${data.error || 'Failed to process the file. Please try again.'}</p>`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (error) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: '<p>Failed to process the file. Please try again later.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleSendText = async () => {
    if (!input.trim()) return;

    const userMessage = {
      type: 'user',
      content: `<p>${input}</p>`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      setIsTyping(false);

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            type: 'assistant',
            content: `<p>${data.error || 'Failed to get a response. Please try again.'}</p>`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (error) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: '<p>An error occurred while processing your request. Please try again later.</p>',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        type: 'assistant',
        content: "<p>Hello! I'm MediChat AI, your personal health assistant. How can I assist you today?</p>",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInput('');
    setFile(null);
    setShowFileTypeMenu(false);
    setReportProcessed(false);
  };

  const handleLogout = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch((error) => console.error('Logout cleanup failed:', error));
    }
    logout();
    navigate('/login');
  };

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="vh-100 bg-gradient-to-br from-blue-50 to-indigo-50 d-flex flex-column overflow-hidden">
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm position-sticky top-0" style={{ zIndex: 10 }}>
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <Bot size={32} className="text-primary me-2" />
            <span className="fw-bold fs-4">MediChat AI</span>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <div className="ms-auto d-flex align-items-center">
              <button
                className="btn btn-outline-primary me-2"
                onClick={() => navigate('/')}
              >
                <ChevronLeft size={20} className="me-1" />
                Back to Home
              </button>
              <div className="dropdown">
                <button
                  className="btn btn-outline-primary dropdown-toggle d-flex align-items-center"
                  type="button"
                  id="profileDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <User size={20} className="me-1" />
                  {user?.username || 'User'}
                </button>
                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="profileDropdown">
                  <li>
                    <Link className="dropdown-item" to="/profile">
                      <User size={16} className="me-2" />
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/feedback">
                      <MessageSquare size={16} className="me-2" />
                      Feedback
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/help">
                      <HelpCircle size={16} className="me-2" />
                      Help
                    </Link>
                  </li>
                  <li>
                    <button className="dropdown-item" onClick={handleLogout}>
                      <LogOut size={16} className="me-2" />
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container flex-1 d-flex flex-column py-3">
        <div
          ref={chatAreaRef}
          className="flex-1 overflow-auto mb-3"
          style={{ maxHeight: chatHeight, minHeight: chatHeight }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`d-flex animate__animated animate__fadeInUp mb-3 ${
                message.type === 'user' ? 'justify-content-end' : 'justify-content-start'
              } ${message.type === 'system' ? 'justify-content-center' : ''}`}
            >
              <div
                className={`d-flex align-items-start ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {message.type !== 'system' && (
                  <div className={`mx-2 ${message.type === 'user' ? 'ms-3' : 'me-3'}`}>
                    {message.type === 'user' ? (
                      <User size={32} className="text-primary" />
                    ) : (
                      <Bot size={32} className="text-primary" />
                    )}
                  </div>
                )}
                <div
                  className={`rounded-3 p-3 shadow-sm ${
                    message.type === 'user'
                      ? 'bg-primary text-white'
                      : message.type === 'system'
                      ? 'bg-light text-muted text-center'
                      : 'bg-white text-dark'
                  }`}
                  style={{ maxWidth: '70%' }}
                >
                  {typeof message.content === 'string' ? (
                    <div
                      className="mb-1"
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                  ) : (
                    message.content
                  )}
                  <small className="text-muted">{message.timestamp}</small>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="d-flex justify-content-start mb-3">
              <div className="d-flex align-items-center">
                <Bot size={32} className="text-primary me-3" />
                <div className="bg-white rounded-3 p-3 shadow-sm">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="row g-3 mb-3 position-sticky" style={{ bottom: '120px', zIndex: 9 }}>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="col-6 col-md-3">
              <button
                className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                onClick={() => setInput(suggestion)}
              >
                <Lightbulb size={16} className="text-warning" />
                <span className="text-sm">{suggestion}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3 shadow-lg p-3 border position-sticky bottom-0" style={{ zIndex: 10 }}>
          <div className="d-flex flex-column gap-3">
            <div className="d-flex gap-3 align-items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={reportProcessed ? "Ask a question about your medical report..." : "Ask me anything about your health..."}
                className="form-control flex-1 bg-light text-dark border-0 resize-none"
                rows={2}
                style={{ boxShadow: 'none' }}
              />
              <button
                className="btn btn-primary btn-circle"
                onClick={handleSendText}
                disabled={!input.trim()}
              >
                <Send size={24} />
              </button>
            </div>
            <div className="d-flex gap-3 align-items-center position-relative">
              <button
                className={`btn btn-circle ${isRecording ? 'btn-danger' : 'btn-success'}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                <Mic size={24} />
              </button>
              <div className="position-relative">
                <button
                  className="btn btn-circle btn-info upload-btn"
                  onClick={() => setShowFileTypeMenu(!showFileTypeMenu)}
                >
                  <Upload size={24} />
                </button>
                {showFileTypeMenu && (
                  <div
                    className="file-type-menu position-absolute bg-light border rounded p-2 shadow-sm d-flex flex-column gap-1"
                    style={{ bottom: '50px', left: 0, zIndex: 1000 }}
                  >
                    <button
                      className="btn btn-outline-secondary d-flex align-items-center gap-2"
                      onClick={() => handleFileTypeSelect('pdf')}
                    >
                      <FileText size={16} />
                      PDF
                    </button>
                    <button
                      className="btn btn-outline-secondary d-flex align-items-center gap-2"
                      onClick={() => handleFileTypeSelect('image')}
                    >
                      <Image size={16} />
                      Image
                    </button>
                    <button
                      className="btn btn-outline-secondary d-flex align-items-center gap-2"
                      onClick={() => handleFileTypeSelect('audio')}
                    >
                      <Music size={16} />
                      Audio
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
              {file && (
                <>
                  <button
                    className="btn btn-circle btn-primary"
                    onClick={handleSendFile}
                  >
                    <Send size={24} />
                  </button>
                  <button
                    className="btn btn-circle btn-danger"
                    onClick={() => setFile(null)}
                  >
                    <Trash2 size={24} />
                  </button>
                </>
              )}
              <button
                className="btn btn-circle btn-danger ms-auto"
                onClick={clearChat}
              >
                <Trash2 size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatPage;