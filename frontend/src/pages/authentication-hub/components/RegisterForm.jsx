import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { api } from '../../../utils/api';
import { initializeApp, getApp, getApps } from 'firebase/app';

const GOOGLE_LOGO_SRC = '/assets/images/google-logo.svg';

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

const RegisterForm = ({ onSwitchToLogin, onAuthenticationSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    agreeToTerms: false,
    subscribeNewsletter: false
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const roleOptions = [
    { value: 'homeowner', label: 'Homeowner', description: 'Individual property owner' },
    { value: 'property_investor', label: 'Property Investor', description: 'Real estate investment professional' },
    { value: 'real_estate_agent', label: 'Real Estate Agent', description: 'Licensed real estate professional' }
  ];

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

  const handleRoleChange = (value) => {
    setFormData(prev => ({ ...prev, role: value }));
    if (errors?.role) {
      setErrors(prev => ({ ...prev, role: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData?.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData?.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData?.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(formData?.password)) {
      newErrors.password = 'Password must include uppercase, lowercase, number, and special character';
    }
    if (!formData?.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData?.role) {
      newErrors.role = 'Please select your role';
    }
    if (!formData?.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
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
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
      };
      const data = await api.post('/api/auth/register', payload);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(data?.user));
      // Store token for Authorization header fallback
      if (data?.token) {
        localStorage.setItem('authToken', data.token);
      }
      onAuthenticationSuccess(data?.user);
    } catch (err) {
      // Map backend validation errors to fields if available
      const backendErrors = err?.data?.errors;
      if (Array.isArray(backendErrors) && backendErrors.length) {
        const fieldErrors = {};
        backendErrors.forEach(({ field, message }) => {
          if (field === 'name') fieldErrors.firstName = message;
          if (field === 'email') fieldErrors.email = message;
          if (field === 'password') fieldErrors.password = message;
        });
        setErrors(prev => ({ ...prev, ...fieldErrors }));
      } else {
        setErrors({ general: err?.data?.message || err.message || 'Registration failed' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const { GoogleAuthProvider, getAuth, signInWithPopup } = await import('firebase/auth');
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
      console.error('Google signup error:', err);
      setErrors({
        general: err?.data?.message || err.message || 'Google signup failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Create Account</h2>
        <p className="text-muted-foreground">Join Consultabid to get started</p>
      </div>
      {errors?.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{errors?.general}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={handleGoogleSignup}
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
            <span className="px-2 bg-background text-muted-foreground">Or sign up with email</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            type="text"
            name="firstName"
            placeholder="John"
            value={formData?.firstName}
            onChange={handleInputChange}
            error={errors?.firstName}
            required
          />

          <Input
            label="Last Name"
            type="text"
            name="lastName"
            placeholder="Smith"
            value={formData?.lastName}
            onChange={handleInputChange}
            error={errors?.lastName}
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          name="email"
          placeholder="john@example.com"
          value={formData?.email}
          onChange={handleInputChange}
          error={errors?.email}
          required
        />

        <Select
          label="I am a..."
          placeholder="Select your role"
          options={roleOptions}
          value={formData?.role}
          onChange={handleRoleChange}
          error={errors?.role}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          placeholder="Create a strong password"
          value={formData?.password}
          onChange={handleInputChange}
          error={errors?.password}
          description="Must be 8+ characters with uppercase, lowercase, number, and special character"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          placeholder="Confirm your password"
          value={formData?.confirmPassword}
          onChange={handleInputChange}
          error={errors?.confirmPassword}
          required
        />

        <div className="space-y-4">
          <Checkbox
            label="I agree to the Terms of Service and Privacy Policy"
            name="agreeToTerms"
            checked={formData?.agreeToTerms}
            onChange={handleInputChange}
            error={errors?.agreeToTerms}
            required
          />

          <Checkbox
            label="Subscribe to newsletter for updates and tips"
            name="subscribeNewsletter"
            checked={formData?.subscribeNewsletter}
            onChange={handleInputChange}
          />
        </div>

        <Button
          type="submit"
          variant="default"
          fullWidth
          loading={isLoading}
          disabled={isLoading}
        >
          Create Account
        </Button>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary hover:text-primary/80 font-medium transition-smooth"
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;
