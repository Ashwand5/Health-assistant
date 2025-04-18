import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Signup from './components/Signup';
import Login from './components/Login';
import ChatPage from './components/ChatPage';
import FoodAnalysis from './components/FoodAnalysis';
import FitnessTracker from './components/FitnessTracker';
import ProfileSetup from './components/ProfileSetup';
import Profile from './components/Profile';
import NotFound from './components/NotFound';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/food-analysis" element={<FoodAnalysis />} />
          <Route path="/fitness-tracker" element={<FitnessTracker />} />
          <Route path="/profile-setup" element={<ProfileSetup />} /> {/* Removed ProtectedRoute */}
          <Route path="/profile" element={<Profile />} /> {/* Removed ProtectedRoute */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;