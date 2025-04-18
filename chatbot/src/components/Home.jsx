import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  Utensils, // Replace ClipboardList with Utensils for Food Analysis
  Dumbbell,
  ArrowRight,
  User,
  LogOut,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';

function Home() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State for dropdown

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="hero">
      <nav className="navbar navbar-expand-lg navbar-light">
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
              {isLoggedIn ? (
                <div className="dropdown">
                  <button
                    className="btn btn-outline-primary d-flex align-items-center"
                    type="button"
                    onClick={toggleDropdown}
                  >
                    <User size={20} className="me-1" />
                    {user?.username || 'User'}
                    <span className={`ms-1 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  {isDropdownOpen && (
                    <ul className="dropdown-menu dropdown-menu-end show">
                      <li>
                        <Link className="dropdown-item" to="/profile" onClick={toggleDropdown}>
                          <User size={16} className="me-2" />
                          Profile
                        </Link>
                      </li>
                      <li>
                        <Link className="dropdown-item" to="/feedback" onClick={toggleDropdown}>
                          <MessageSquare size={16} className="me-2" />
                          Feedback
                        </Link>
                      </li>
                      <li>
                        <Link className="dropdown-item" to="/help" onClick={toggleDropdown}>
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
                            toggleDropdown();
                          }}
                        >
                          <LogOut size={16} className="me-2" />
                          Logout
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <button
                    className="btn btn-outline-primary me-2"
                    onClick={() => navigate('/login')}
                  >
                    <User size={20} className="me-1" />
                    Login
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/signup')}
                  >
                    <User size={20} className="me-1" />
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Updated Hero Content */}
      <div className="hero-content">
        <div className="text-center animate__animated animate__fadeIn">
          <h1 className="display-3 fw-bold text-dark mb-4">
            Your Personal Health Assistant
          </h1>
          <p className="lead text-muted mb-5 mx-auto" style={{ maxWidth: '800px' }}>
            Get instant medical guidance, track your fitness, and analyze your food with our advanced AI-powered chatbot.
          </p>
          <button
            className="btn btn-primary btn-lg mb-5"
            onClick={() => navigate(isLoggedIn ? '/chat' : '/signup')}
          >
            Get Started Now
          </button>
        </div>

        <div className="row g-5 justify-content-center">
          <div className="col-md-4 col-lg-3 mb-4">
            <div className="card h-100 shadow-sm border-0 animate__animated animate__fadeInUp animate__delay-1s">
              <div className="card-body text-center">
                <Bot size={48} className="text-success mb-3" />
                <h3 className="card-title fw-semibold">AI Chat</h3>
                <p className="card-text text-muted">Get instant medical guidance from our AI assistant</p>
                <button
                  className="btn btn-success mt-3 d-flex align-items-center justify-content-center mx-auto"
                  onClick={() => navigate('/chat')}
                >
                  Start Chat
                  <ArrowRight size={16} className="ms-2" />
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-lg-3 mb-4">
            <div className="card h-100 shadow-sm border-0 animate__animated animate__fadeInUp animate__delay-2s">
              <div className="card-body text-center">
                <Utensils size={48} className="text-info mb-3" /> {/* Replaced ClipboardList with Utensils */}
                <h3 className="card-title fw-semibold">Food Analysis</h3>
                <p className="card-text text-muted">Upload and analyze your food for nutritional insights</p>
                <button
                  className="btn btn-info mt-3 d-flex align-items-center justify-content-center mx-auto"
                  onClick={() => navigate('/food-analysis')}>
                  Analyze Food
                  <ArrowRight size={16} className="ms-2" />
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-lg-3 mb-4">
            <div className="card h-100 shadow-sm border-0 animate__animated animate__fadeInUp animate__delay-3s">
              <div className="card-body text-center">
                <Dumbbell size={48} className="text-warning mb-3" />
                <h3 className="card-title fw-semibold">Fitness Tracker</h3>
                <p className="card-text text-muted">Monitor and track your fitness activities and goals</p>
                <button
                  className="btn btn-warning mt-3 d-flex align-items-center justify-content-center mx-auto"
                  onClick={() => navigate('/fitness-tracker')}
                >
                  Track Fitness
                  <ArrowRight size={16} className="ms-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div className="container text-center text-muted">
          © 2025 MediChat AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default Home;