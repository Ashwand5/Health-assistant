import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, LogOut, MessageSquare, HelpCircle, Upload } from 'lucide-react'; // Removed Utensils
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';

function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [collection, setCollection] = useState('Admin'); // Default collection
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!token || !isAdmin) {
      navigate('/admin-login');
    }
  }, [navigate]);

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    // Validate file type (only allow PDFs)
    if (uploadedFile.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      setFile(null);
      return;
    }

    setFile(uploadedFile);
    setMessage('');
    setError('');
  };

  const handleCollectionChange = (e) => {
    setCollection(e.target.value);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('collection', collection);

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        setFile(null);
      } else {
        setError(data.error || 'Failed to upload PDF');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    navigate('/admin-login');
  };

  return (
    <div className="vh-100 bg-gradient-to-br from-blue-50 to-indigo-50 d-flex flex-column overflow-hidden">
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm position-sticky top-0" style={{ zIndex: 10 }}>
        <div className="container">
          <button
            className="btn btn-outline-primary me-2"
            onClick={() => navigate('/')}
          >
            <ChevronLeft size={20} className="me-1" />
            Back to Home
          </button>
          <div className="ms-auto d-flex align-items-center">
            <div className="dropdown">
              <button
                className="btn btn-outline-primary dropdown-toggle d-flex align-items-center"
                type="button"
                id="profileDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <User size={20} className="me-1" />
                Admin
              </button>
              <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="profileDropdown">
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
                    onClick={handleLogout}
                  >
                    <LogOut size={16} className="me-2" />
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container flex-1 d-flex flex-column py-3">
        <h1 className="text-center mb-4">Admin Dashboard</h1>
        <p className="text-center text-muted mb-4">
          Upload PDF documents to manage content in Weaviate collections.
        </p>

        {/* PDF Upload Section */}
        <div className="d-flex flex-column align-items-center mb-4">
          {message && <p className="text-success">{message}</p>}
          {error && <p className="text-danger">{error}</p>}
          <form onSubmit={handleUpload} className="w-100" style={{ maxWidth: '500px' }}>
            <div className="mb-3">
              <label className="form-label">Select Collection:</label>
              <select
                className="form-select"
                value={collection}
                onChange={handleCollectionChange}
              >
                <option value="Admin">Admin</option>
                <option value="food_analyse">Food Knowledge</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Select PDF File:</label>
              <input
                type="file"
                className="form-control"
                accept="application/pdf"
                onChange={handleFileChange}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary d-flex align-items-center gap-2 w-100"
            >
              <Upload size={20} />
              Upload PDF
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;