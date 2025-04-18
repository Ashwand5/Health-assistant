import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';

function Feedback() {
  const navigate = useNavigate();

  return (
    <div className="vh-100 bg-gradient-to-br from-blue-50 to-indigo-50 d-flex flex-column overflow-hidden">
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm position-sticky top-0" style={{ zIndex: 10 }}>
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <MessageSquare size={32} className="text-primary me-2" />
            <span className="fw-bold fs-4">Feedback</span>
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
            <div className="ms-auto">
              <button
                className="btn btn-outline-primary me-2"
                onClick={() => navigate('/')}
              >
                <ChevronLeft size={20} className="me-1" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container flex-1 d-flex flex-column py-3">
        <h1 className="text-center mb-4">Feedback</h1>
        <p className="text-center text-muted">
          We value your feedback! This feature is coming soon.
        </p>
      </div>
    </div>
  );
}

export default Feedback;