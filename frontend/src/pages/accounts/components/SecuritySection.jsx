import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

const SecuritySection = ({ user, onSuccess, onError }) => {
  const { addNotification } = useNotifications();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  // Don't show password change for Google OAuth users
  const isGoogleUser = user?.authProvider === 'GOOGLE';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return errors;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      newErrors.newPassword = passwordErrors[0];
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    return newErrors;
  };

  const handleChangePassword = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      const result = await api.put('/api/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      if (result && result.success) {
        onSuccess('Password changed successfully');
        addNotification({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully',
        });
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setShowPasswordForm(false);
        setErrors({});
      } else {
        onError(result?.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      const errorMessage = error?.data?.message || error?.message || 'Failed to change password';
      if (errorMessage.includes('current password') || errorMessage.includes('incorrect')) {
        setErrors({ currentPassword: 'Current password is incorrect' });
      } else {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setErrors({});
    setShowPasswordForm(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Security Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your password and security preferences
        </p>
      </div>

      {isGoogleUser ? (
        <div className="bg-muted/50 rounded-lg border border-border p-6">
          <div className="flex items-start space-x-4">
            <Icon name="Info" size={24} className="text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-medium text-foreground mb-2">Google Account</h3>
              <p className="text-sm text-muted-foreground">
                You're signed in with Google. Your password is managed by your Google account.
                To change your password, please visit your{' '}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Account settings
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!showPasswordForm ? (
            <div className="space-y-4">
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground mb-1">Password</h3>
                    <p className="text-sm text-muted-foreground">
                      Last changed: {user?.updatedAt 
                        ? new Date(user.updatedAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'Never'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordForm(true)}
                    iconName="Key"
                    iconPosition="left"
                  >
                    Change Password
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg border border-border p-4">
                <div className="flex items-start space-x-3">
                  <Icon name="Shield" size={20} className="text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Security Tips</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Use a strong, unique password</li>
                      <li>Don't share your password with anyone</li>
                      <li>Enable two-factor authentication if available</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg border border-border p-6">
                <h3 className="font-medium text-foreground mb-4">Change Password</h3>
                
                <div className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    error={errors.currentPassword}
                    required
                  />

                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    error={errors.newPassword}
                    description="Must be 8+ characters with uppercase, lowercase, number, and special character"
                    required
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    error={errors.confirmPassword}
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleChangePassword}
                    loading={loading}
                    disabled={loading}
                    iconName="Save"
                    iconPosition="left"
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SecuritySection;

