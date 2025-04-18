import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'; // Add useMap
import 'leaflet/dist/leaflet.css';
import {
  ChevronLeft,
  Play,
  Pause,
  Dumbbell,
  MapPin,
  Clock,
  Ruler,
  Flame,
  User,
  LogOut,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';

// MET values for different exercises
const MET_VALUES = {
  walking: 3.8, // 3.5 mph
  jogging: 7.0, // 5 mph
  running: 9.8, // 6 mph
};

// Component to adjust map bounds dynamically
function MapAdjuster({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = positions.map(([lat, lng]) => [lat, lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);

  return null;
}

function FitnessTracker() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useUser();
  const [exerciseType, setExerciseType] = useState('walking');
  const [isTracking, setIsTracking] = useState(false);
  const [positions, setPositions] = useState([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [weight, setWeight] = useState(70);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  // Default center (e.g., a fallback location like New York City)
  const defaultCenter = [40.7128, -74.0060]; // [latitude, longitude]

  // Debug positions
  useEffect(() => {
    console.log('Updated positions:', positions);
  }, [positions]);

  // Calculate distance between two lat/lng points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Start tracking location
  const startTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsTracking(true);
    setPositions([]);
    setDistance(0);
    setDuration(0);
    setCaloriesBurned(0);

    intervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('New position:', { latitude, longitude }); // Debug log
        setPositions((prev) => {
          const newPositions = [...prev, [latitude, longitude]];
          if (newPositions.length > 1) {
            const lastPos = newPositions[newPositions.length - 2];
            const newPos = newPositions[newPositions.length - 1];
            const segmentDistance = calculateDistance(lastPos[0], lastPos[1], newPos[0], newPos[1]);
            setDistance((prev) => prev + segmentDistance);
          }
          return newPositions;
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to access your location. Please ensure location permissions are enabled.');
        stopTracking();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Stop tracking location
  const stopTracking = () => {
    setIsTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    calculateCalories();
  };

  // Calculate calories burned
  const calculateCalories = () => {
    const met = MET_VALUES[exerciseType];
    const durationHours = duration / 3600;
    const calories = met * weight * durationHours;
    setCaloriesBurned(Math.round(calories));
  };

  useEffect(() => {
    if (isTracking) {
      calculateCalories();
    }
  }, [duration, exerciseType, weight, isTracking, calculateCalories]);

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate speed (km/h)
  const calculateSpeed = () => {
    if (duration === 0) return 0;
    const durationHours = duration / 3600;
    return (distance / durationHours).toFixed(2);
  };

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="vh-100 bg-gradient-to-br from-blue-50 to-indigo-50 d-flex flex-column overflow-hidden">
      {/* Navigation */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm position-sticky top-0" style={{ zIndex: 10 }}>
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <Dumbbell size={32} className="text-primary me-2" />
            <span className="fw-bold fs-4">Fitness Tracker</span>
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

      {/* Main Content */}
      <div className="container flex-1 d-flex flex-column py-3">
        {/* Exercise Selection and Controls */}
        <div className="mb-4">
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              <label htmlFor="exerciseType" className="form-label fw-semibold">
                Select Exercise
              </label>
              <select
                id="exerciseType"
                className="form-select"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                disabled={isTracking}
              >
                <option value="walking">Walking</option>
                <option value="jogging">Jogging</option>
                <option value="running">Running</option>
              </select>
            </div>
            <div className="col-md-4">
              <label htmlFor="weight" className="form-label fw-semibold">
                Weight (kg)
              </label>
              <input
                type="number"
                id="weight"
                className="form-control"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                disabled={isTracking}
                min="1"
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button
                className={`btn btn-lg w-100 ${isTracking ? 'btn-danger' : 'btn-success'}`}
                onClick={isTracking ? stopTracking : startTracking}
              >
                {isTracking ? (
                  <>
                    <Pause size={20} className="me-2" />
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <Play size={20} className="me-2" />
                    Start Tracking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Map Visualization */}
        <div className="mb-4 flex-1" style={{ height: '300px' }}>
          <MapContainer
            center={positions.length > 0 ? positions[0] : defaultCenter} // Use default center if positions is empty
            zoom={15}
            style={{ height: '100%', width: '100%', borderRadius: '8px' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {positions.length > 0 && <Polyline positions={positions} color="blue" />}
            <MapAdjuster positions={positions} /> {/* Add MapAdjuster to dynamically adjust bounds */}
          </MapContainer>
        </div>

        {/* Exercise Summary */}
        <div className="row g-3">
          <div className="col-md-3">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center">
                <MapPin size={24} className="text-primary mb-2" />
                <h5 className="card-title">Distance</h5>
                <p className="card-text">{distance.toFixed(2)} km</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center">
                <Clock size={24} className="text-primary mb-2" />
                <h5 className="card-title">Duration</h5>
                <p className="card-text">{formatDuration(duration)}</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center">
                <Ruler size={24} className="text-primary mb-2" />
                <h5 className="card-title">Speed</h5>
                <p className="card-text">{calculateSpeed()} km/h</p>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card shadow-sm border-0">
              <div className="card-body text-center">
                <Flame size={24} className="text-primary mb-2" />
                <h5 className="card-title">Calories Burned</h5>
                <p className="card-text">{caloriesBurned} kcal</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FitnessTracker;