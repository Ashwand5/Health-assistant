import React, { useState, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { ChevronLeft, Utensils, User, LogOut, MessageSquare, HelpCircle, Upload, Trash2 } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';

function FoodAnalysis() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useUser();
  const [image, setImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  const handleImageUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validImageTypes.includes(uploadedFile.type)) {
      setAnalysisResult({
        type: 'error',
        message: 'Please upload a valid image file (JPEG, PNG, or GIF).',
      });
      setImage(null);
      return;
    }

    setImage(uploadedFile);
    setAnalysisResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      const response = await fetch('http://localhost:5000/api/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze the image.');
      }

      const data = await response.json();
      console.log('Response data:', data); // Debug the response

      // Robust parsing of message
      const messageParts = data.message.match(/I’ve detected ([\w\s]+) with (\d+\.\d+)% confidence/);
      const detectedFood = messageParts ? messageParts[1] : 'Unknown';
      const confidence = messageParts ? messageParts[2] : 'N/A';

      setAnalysisResult({
        type: 'success',
        message: (
          <div>
            <p><strong>Food Analysis Result:</strong></p>
            <p>Detected food: {detectedFood}</p>
            <p>Confidence: {confidence}%</p>
            <div
              className="analysis-content"
              dangerouslySetInnerHTML={{ __html: data.analysis }}
            />
          </div>
        ),
      });
    } catch (err) {
      console.error('Upload error:', err.message);
      setAnalysisResult({
        type: 'error',
        message: err.message || 'An error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setAnalysisResult(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="min-vh-100 bg-gradient-to-br from-blue-50 to-indigo-50 d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm position-sticky top-0" style={{ zIndex: 10 }}>
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <Utensils size={32} className="text-primary me-2" />
            <span className="fw-bold fs-4">Food Analysis</span>
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
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        logout();
                        navigate('/login');
                      }}
                    >
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

      <div className="container flex-grow-1 d-flex flex-column py-3">
        <h1 className="text-center mb-4">Food Analysis</h1>
        <p className="text-center text-muted mb-4">
          Upload an image of your food to analyze its nutritional content.
        </p>

        <div className="d-flex flex-column align-items-center mb-4">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/png,image/gif"
            onChange={handleImageUpload}
          />
          {!image ? (
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={handleUploadClick}
              disabled={loading}
            >
              <Upload size={20} />
              {loading ? 'Analyzing...' : 'Upload Food Image'}
            </button>
          ) : (
            <div className="position-relative">
              <img
                src={URL.createObjectURL(image)}
                alt="Uploaded Food"
                className="rounded-3 shadow-sm mb-3"
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
              />
              <button
                className="btn btn-danger btn-sm position-absolute top-0 end-0"
                onClick={handleRemoveImage}
                style={{ transform: 'translate(50%, -50%)' }}
                disabled={loading}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {analysisResult && (
          <div
            className="bg-white rounded-3 p-4 shadow-sm text-left analysis-container"
            style={{
              maxHeight: '60vh', // Set a reasonable maximum height (60% of viewport height)
              overflowY: 'auto', // Enable vertical scrolling
              maxWidth: '100%', // Ensure it fits the container width
              wordWrap: 'break-word', // Prevent long words from overflowing
            }}
          >
            {analysisResult.type === 'error' ? (
              <p className="text-danger">{analysisResult.message}</p>
            ) : (
              analysisResult.message
            )}
          </div>
        )}
      </div>
    </div>
);
}

export default FoodAnalysis;