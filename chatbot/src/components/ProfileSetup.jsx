import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Mars, Phone, Home, AlertCircle, FileText, Cigarette, Utensils, CheckCircle } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import '../App.css';
import { useUser } from '../context/UserContext';

function ProfileSetup() {
  const navigate = useNavigate();
  const { token } = useUser();

  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    contactNumber: '',
    homeAddress: '',
    emergencyContactName: '',
    relationship: '',
    emergencyContactNumber: '',
    chronicConditions: [],
    allergies: [],
    currentMedications: [],
    smokingAlcohol: '',
    dietaryPreferences: '',
    consentDataUse: false,
    preferredCommunication: 'Email',
    notificationPreferences: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [conditionInput, setConditionInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

  if (!token) {
    navigate('/login');
    return null;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleListChange = (field, value, setInput) => {
    if (value.trim()) {
      setFormData({
        ...formData,
        [field]: [...formData[field], value.trim()],
      });
      setInput('');
    }
  };

  const handleRemoveItem = (field, item) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((i) => i !== item),
    });
  };

  const handleNotificationPreference = (e) => {
    const value = e.target.value;
    setFormData({
      ...formData,
      notificationPreferences: formData.notificationPreferences.includes(value)
        ? formData.notificationPreferences.filter((pref) => pref !== value)
        : [...formData.notificationPreferences, value],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      navigate('/');
    } catch (err) {
      console.error('Profile setup error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center bg-gradient-to-br from-blue-50 to-indigo-50 py-4" style={{ minHeight: '100vh' }}>
      <div className="card shadow-lg p-4 animate__animated animate__fadeIn" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="card-body">
          <h2 className="text-center mb-4">Set Up Your Medical Profile</h2>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            {/* Personal Information */}
            <h5>Personal Information</h5>
            <div className="mb-3">
              <label htmlFor="fullName" className="form-label">
                <User size={20} className="me-2" />
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                className="form-control"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="dateOfBirth" className="form-label">
                <Calendar size={20} className="me-2" />
                Date of Birth
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                className="form-control"
                value={formData.dateOfBirth}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="gender" className="form-label">
                <Mars size={20} className="me-2" />
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                className="form-control"
                value={formData.gender}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="contactNumber" className="form-label">
                <Phone size={20} className="me-2" />
                Contact Number
              </label>
              <input
                type="tel"
                id="contactNumber"
                name="contactNumber"
                className="form-control"
                value={formData.contactNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="homeAddress" className="form-label">
                <Home size={20} className="me-2" />
                Home Address
              </label>
              <textarea
                id="homeAddress"
                name="homeAddress"
                className="form-control"
                value={formData.homeAddress}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Emergency Contact */}
            <h5>Emergency Contact</h5>
            <div className="mb-3">
              <label htmlFor="emergencyContactName" className="form-label">
                <AlertCircle size={20} className="me-2" />
                Emergency Contact Name
              </label>
              <input
                type="text"
                id="emergencyContactName"
                name="emergencyContactName"
                className="form-control"
                value={formData.emergencyContactName}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="relationship" className="form-label">
                Relationship
              </label>
              <input
                type="text"
                id="relationship"
                name="relationship"
                className="form-control"
                value={formData.relationship}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="emergencyContactNumber" className="form-label">
                <Phone size={20} className="me-2" />
                Emergency Contact Number
              </label>
              <input
                type="tel"
                id="emergencyContactNumber"
                name="emergencyContactNumber"
                className="form-control"
                value={formData.emergencyContactNumber}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Medical History */}
            <h5>Medical History</h5>
            <div className="mb-3">
              <label htmlFor="chronicConditions" className="form-label">
                <FileText size={20} className="me-2" />
                Chronic Conditions (e.g., diabetes, hypertension)
              </label>
              <div className="input-group mb-2">
                <input
                  type="text"
                  id="chronicConditions"
                  className="form-control"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  placeholder="Add a condition"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => handleListChange('chronicConditions', conditionInput, setConditionInput)}
                  disabled={loading}
                >
                  Add
                </button>
              </div>
              {formData.chronicConditions.length > 0 && (
                <ul className="list-group mb-2">
                  {formData.chronicConditions.map((condition, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                      {condition}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveItem('chronicConditions', condition)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-3">
              <label htmlFor="allergies" className="form-label">
                <FileText size={20} className="me-2" />
                Allergies (e.g., medications, food)
              </label>
              <div className="input-group mb-2">
                <input
                  type="text"
                  id="allergies"
                  className="form-control"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  placeholder="Add an allergy"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => handleListChange('allergies', allergyInput, setAllergyInput)}
                  disabled={loading}
                >
                  Add
                </button>
              </div>
              {formData.allergies.length > 0 && (
                <ul className="list-group mb-2">
                  {formData.allergies.map((allergy, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                      {allergy}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveItem('allergies', allergy)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mb-3">
              <label htmlFor="currentMedications" className="form-label">
                <FileText size={20} className="me-2" />
                Current Medications (e.g., name, dosage)
              </label>
              <div className="input-group mb-2">
                <input
                  type="text"
                  id="currentMedications"
                  className="form-control"
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  placeholder="Add a medication"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => handleListChange('currentMedications', medicationInput, setMedicationInput)}
                  disabled={loading}
                >
                  Add
                </button>
              </div>
              {formData.currentMedications.length > 0 && (
                <ul className="list-group mb-2">
                  {formData.currentMedications.map((medication, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                      {medication}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveItem('currentMedications', medication)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Lifestyle Information */}
            <h5>Lifestyle Information</h5>
            <div className="mb-3">
              <label htmlFor="smokingAlcohol" className="form-label">
                <Cigarette size={20} className="me-2" />
                Smoking & Alcohol Consumption
              </label>
              <input
                type="text"
                id="smokingAlcohol"
                name="smokingAlcohol"
                className="form-control"
                value={formData.smokingAlcohol}
                onChange={handleChange}
                placeholder="e.g., Non-smoker, occasional drinker"
                disabled={loading}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="dietaryPreferences" className="form-label">
                <Utensils size={20} className="me-2" />
                Dietary Preferences
              </label>
              <input
                type="text"
                id="dietaryPreferences"
                name="dietaryPreferences"
                className="form-control"
                value={formData.dietaryPreferences}
                onChange={handleChange}
                placeholder="e.g., Vegetarian, low-carb"
                disabled={loading}
              />
            </div>

            {/* Consent & Preferences */}
            <h5>Consent & Preferences</h5>
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                id="consentDataUse"
                name="consentDataUse"
                className="form-check-input"
                checked={formData.consentDataUse}
                onChange={handleChange}
                disabled={loading}
              />
              <label htmlFor="consentDataUse" className="form-check-label">
                <CheckCircle size={20} className="me-2" />
                I consent to the storage and use of my data
              </label>
            </div>
            <div className="mb-3">
              <label htmlFor="preferredCommunication" className="form-label">
                Preferred Communication Method
              </label>
              <select
                id="preferredCommunication"
                name="preferredCommunication"
                className="form-control"
                value={formData.preferredCommunication}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="Call">Call</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Notification Preferences</label>
              <div className="form-check">
                <input
                  type="checkbox"
                  id="appointmentReminders"
                  value="appointmentReminders"
                  className="form-check-input"
                  checked={formData.notificationPreferences.includes('appointmentReminders')}
                  onChange={handleNotificationPreference}
                  disabled={loading}
                />
                <label htmlFor="appointmentReminders" className="form-check-label">
                  Appointment Reminders
                </label>
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  id="healthTips"
                  value="healthTips"
                  className="form-check-input"
                  checked={formData.notificationPreferences.includes('healthTips')}
                  onChange={handleNotificationPreference}
                  disabled={loading}
                />
                <label htmlFor="healthTips" className="form-check-label">
                  Health Tips
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                'Save Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfileSetup;