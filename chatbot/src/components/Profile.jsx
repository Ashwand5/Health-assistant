import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Mars, Phone, Home, AlertCircle, FileText, Cigarette, Utensils, CheckCircle, Mail } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';


function Profile() {
  const navigate = useNavigate();
  const { token, isLoggedIn } = useUser();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch profile');
        }

        setProfile(data.profile);
      } catch (err) {
        console.error('Profile fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isLoggedIn, navigate, token]);

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <div className="flex-grow-1 d-flex align-items-center justify-content-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div
          className="card shadow-lg p-4 animate__animated animate__fadeIn"
          style={{ maxWidth: '600px', width: '100%' }}
        >
          <div
            className="card-body"
            style={{ maxHeight: '70vh', overflowY: 'auto' }}
          >
            <h2 className="text-center mb-4">Your Medical Profile</h2>
            {error && <div className="alert alert-danger">{error}</div>}
            {profile ? (
              <div>
                {/* Personal Information */}
                <h5>Personal Information</h5>
                <div className="mb-3">
                  <h6>
                    <User size={20} className="me-2" /> Full Name
                  </h6>
                  <p>{profile?.personal_information?.full_name || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Calendar size={20} className="me-2" /> Date of Birth
                  </h6>
                  <p>{profile?.personal_information?.date_of_birth || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Mars size={20} className="me-2" /> Gender
                  </h6>
                  <p>{profile?.personal_information?.gender || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Phone size={20} className="me-2" /> Contact Number
                  </h6>
                  <p>{profile?.personal_information?.contact_number || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Mail size={20} className="me-2" /> Email Address
                  </h6>
                  <p>{profile?.personal_information?.email_address || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Home size={20} className="me-2" /> Home Address
                  </h6>
                  <p>{profile?.personal_information?.home_address || 'Not provided'}</p>
                </div>

                {/* Emergency Contact */}
                <h5>Emergency Contact</h5>
                <div className="mb-3">
                  <h6>
                    <AlertCircle size={20} className="me-2" /> Name
                  </h6>
                  <p>{profile?.emergency_contact?.name || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>Relationship</h6>
                  <p>{profile?.emergency_contact?.relationship || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Phone size={20} className="me-2" /> Contact Number
                  </h6>
                  <p>{profile?.emergency_contact?.contact_number || 'Not provided'}</p>
                </div>

                {/* Medical History */}
                <h5>Medical History</h5>
                <div className="mb-3">
                  <h6>
                    <FileText size={20} className="me-2" /> Chronic Conditions
                  </h6>
                  {profile?.medical_history?.chronic_conditions?.length > 0 ? (
                    <ul className="list-group">
                      {profile.medical_history.chronic_conditions.map((condition, index) => (
                        <li key={index} className="list-group-item">{condition}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No chronic conditions provided.</p>
                  )}
                </div>
                <div className="mb-3">
                  <h6>
                    <FileText size={20} className="me-2" /> Allergies
                  </h6>
                  {profile?.medical_history?.allergies?.length > 0 ? (
                    <ul className="list-group">
                      {profile.medical_history.allergies.map((allergy, index) => (
                        <li key={index} className="list-group-item">{allergy}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No allergies provided.</p>
                  )}
                </div>
                <div className="mb-3">
                  <h6>
                    <FileText size={20} className="me-2" /> Current Medications
                  </h6>
                  {profile?.medical_history?.current_medications?.length > 0 ? (
                    <ul className="list-group">
                      {profile.medical_history.current_medications.map((medication, index) => (
                        <li key={index} className="list-group-item">{medication}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No current medications provided.</p>
                  )}
                </div>

                {/* Lifestyle Information */}
                <h5>Lifestyle Information</h5>
                <div className="mb-3">
                  <h6>
                    <Cigarette size={20} className="me-2" /> Smoking & Alcohol Consumption
                  </h6>
                  <p>{profile?.lifestyle_information?.smoking_alcohol || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>
                    <Utensils size={20} className="me-2" /> Dietary Preferences
                  </h6>
                  <p>{profile?.lifestyle_information?.dietary_preferences || 'Not provided'}</p>
                </div>

                {/* Consent & Preferences */}
                <h5>Consent & Preferences</h5>
                <div className="mb-3">
                  <h6>
                    <CheckCircle size={20} className="me-2" /> Consent for Data Use
                  </h6>
                  <p>{profile?.consent_preferences?.consent_data_use ? 'Yes' : 'No'}</p>
                </div>
                <div className="mb-3">
                  <h6>Preferred Communication Method</h6>
                  <p>{profile?.consent_preferences?.preferred_communication || 'Not provided'}</p>
                </div>
                <div className="mb-3">
                  <h6>Notification Preferences</h6>
                  {profile?.consent_preferences?.notification_preferences?.length > 0 ? (
                    <ul className="list-group">
                      {profile.consent_preferences.notification_preferences.map((pref, index) => (
                        <li key={index} className="list-group-item">{pref}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No notification preferences selected.</p>
                  )}
                </div>

                <button
                  className="btn btn-primary w-100"
                  onClick={() => navigate('/profile-setup')}
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p>No profile found.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/profile-setup')}
                >
                  Set Up Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;