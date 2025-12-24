import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

const ProfileSection = ({ user, onUserUpdate, onError }) => {
  const { addNotification } = useNotifications();
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [errors, setErrors] = useState({});

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

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      onError('Please upload a JPG or PNG image');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload image
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://seal-app-hbsmr.ondigitalocean.app'}/api/auth/profile/image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (result && result.success) {
        addNotification({
          type: 'success',
          title: 'Profile Picture Updated',
          message: 'Your profile picture has been updated successfully',
        });
        onUserUpdate(result.user);
        setPreviewImage(null);
      } else {
        throw new Error(result?.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      onError(error.message || 'Failed to upload image');
      setPreviewImage(null);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.length > 30) {
      newErrors.name = 'Name cannot exceed 30 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters and spaces';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      const result = await api.put('/api/auth/profile', {
        name: formData.name.trim()
      });

      if (result && result.success) {
        onUserUpdate(result.user);
        setIsEditing(false);
      } else {
        onError(result?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      onError(error?.data?.message || error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Profile Information</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Update your personal information and profile picture
          </p>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            iconName="Edit"
            iconPosition="left"
          >
            Edit Profile
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Profile Picture */}
        <div className="flex items-center space-x-6">
          <div className="relative">
            {previewImage ? (
              <img
                src={previewImage}
                alt={user?.name || 'User'}
                className="w-24 h-24 rounded-full object-cover border-2 border-border"
              />
            ) : user?.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-24 h-24 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <span className="text-3xl font-semibold text-primary">
                  {getInitials(user?.name)}
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Profile Picture</p>
            <p className="text-xs text-muted-foreground mb-3">
              {user?.authProvider === 'GOOGLE' 
                ? 'Your profile picture is managed by Google'
                : 'Upload a new profile picture (JPG, PNG, max 5MB)'}
            </p>
            {user?.authProvider !== 'GOOGLE' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadingImage}
                  disabled={uploadingImage}
                  iconName="Upload"
                  iconPosition="left"
                >
                  {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </>
            )}
          </div>
        </div>

        <hr className="border-border" />

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Full Name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            error={errors.name}
            disabled={!isEditing}
            required
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            error={errors.email}
            disabled={true}
            description="Email cannot be changed"
            required
          />
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              loading={loading}
              disabled={loading}
              iconName="Save"
              iconPosition="left"
            >
              Save Changes
            </Button>
          </div>
        )}

        {/* Account Info */}
        {!isEditing && (
          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Icon name="Calendar" size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="text-sm font-medium text-foreground">
                    {user?.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Icon name="Shield" size={20} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Type</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {user?.authProvider === 'GOOGLE' ? 'Google Account' : 'Email Account'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSection;

