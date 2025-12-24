import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';
import { api } from '../../../utils/api';

import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { GoogleAuthProvider } from "firebase/auth";
import { getAuth, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const GOOGLE_LOGO_SRC = '/assets/images/google-logo.svg';

const LoginForm = ({ onSwitchToRegister, onForgotPassword, onAuthenticationSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors?.[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData?.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors)?.length > 0) {
      setErrors(newErrors);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(data?.user));
      // Store token for Authorization header fallback
      if (data?.token) {
        localStorage.setItem('authToken', data.token);
      }
      onAuthenticationSuccess(data?.user);
    } catch (err) {
      setErrors({
        general: err?.data?.message || err.message || 'Login failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const auth = getAuth(app);
      const result = await signInWithPopup(auth, provider);

      // Send Google auth data to backend
      const googleData = {
        googleId: result?.user?.uid || '',
        email: result?.user?.email || '',
        name: result?.user?.displayName || '',
        avatar: result?.user?.photoURL || '',
      };

      const data = await api.post('/api/auth/google', googleData);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(data?.user));
      // Store token for Authorization header fallback
      if (data?.token) {
        localStorage.setItem('authToken', data.token);
      }
      onAuthenticationSuccess(data?.user);
    } catch (err) {
      console.error('Google login error:', err);
      console.error('Error details:', err?.data);

      // Show detailed validation errors if available
      const backendErrors = err?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const errorMessages = backendErrors.map(e => `${e.field}: ${e.message}`).join(', ');
        setErrors({
          general: `Validation failed: ${errorMessages}`,
        });
      } else {
        setErrors({
          general: err?.data?.message || err.message || 'Google login failed',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome Back</h2>
        <p className="text-muted-foreground">Sign in to your Consultabid account</p>
      </div>

      {errors?.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="AlertCircle" size={16} className="text-red-600" />
            <p className="text-sm text-red-600">{errors?.general}</p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex items-center justify-center gap-2"
        >
          <img
            src={GOOGLE_LOGO_SRC}
            alt="Google logo"
            className="w-5 h-5 object-contain"
          />
          <span>Continue with Google</span>
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">Or sign in with email</span>
          </div>
        </div>

        <Input
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your email"
          value={formData?.email}
          onChange={handleInputChange}
          error={errors?.email}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          placeholder="Enter your password"
          value={formData?.password}
          onChange={handleInputChange}
          error={errors?.password}
          required
        />

        <div className="flex items-center justify-between">
          <Checkbox
            label="Remember me"
            name="rememberMe"
            checked={formData?.rememberMe}
            onChange={handleInputChange}
          />

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-primary hover:text-primary/80 transition-smooth"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          variant="default"
          fullWidth
          loading={isLoading}
          disabled={isLoading}
        >
          Sign In
        </Button>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-primary hover:text-primary/80 font-medium transition-smooth"
            >
              Sign up
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
