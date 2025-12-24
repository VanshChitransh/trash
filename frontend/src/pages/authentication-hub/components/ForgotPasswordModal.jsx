import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import { api } from '../../../utils/api';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setIsSuccess(true);
    } catch (err) {
      setError(err?.data?.message || err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setIsSuccess(false);
    onClose();
  };

  const handleEmailChange = (e) => {
    setEmail(e?.target?.value);
    if (error) setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-moderate animate-slide-down">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Reset Password</h3>
          <button
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-smooth"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6">
          {!isSuccess ? (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={handleEmailChange}
                  error={error}
                  required
                />

                <div className="flex space-x-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    loading={isLoading}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Send Reset Link
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircle" size={32} className="text-green-600" />
              </div>
              
              <h4 className="text-lg font-semibold text-foreground mb-2">Check Your Email</h4>
              
              <p className="text-sm text-muted-foreground mb-6">
                We've sent a password reset link to <strong>{email}</strong>. 
                Please check your email and follow the instructions to reset your password.
              </p>

              <div className="space-y-3">
                <Button
                  variant="default"
                  fullWidth
                  onClick={handleClose}
                >
                  Got it
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Didn't receive the email? Check your spam folder or{' '}
                  <button
                    onClick={() => setIsSuccess(false)}
                    className="text-primary hover:text-primary/80 transition-smooth"
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;