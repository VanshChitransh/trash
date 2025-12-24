import React, { useState, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const FileUploadZone = ({ onFilesUpload, isUploading = false, acceptedTypes = ['.pdf'] }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleDragOver = useCallback((e) => {
    e?.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e?.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e?.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e?.dataTransfer?.files);
    const validFiles = files?.filter(file => 
      acceptedTypes?.some(type => file?.name?.toLowerCase()?.endsWith(type?.toLowerCase()))
    );
    
    if (validFiles?.length > 0) {
      onFilesUpload(validFiles);
    }
  }, [acceptedTypes, onFilesUpload]);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e?.target?.files);
    if (files?.length > 0) {
      onFilesUpload(files);
    }
    e.target.value = '';
  }, [onFilesUpload]);

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        } ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes?.join(',')}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        
        <div className={`flex flex-col items-center space-y-4 transition-opacity duration-200 ${isUploading ? 'opacity-0' : 'opacity-100'}`}>
          <div className={`p-4 rounded-full transition-colors ${
            isDragOver ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <Icon name="Upload" size={32} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragOver ? 'Drop files here' : 'Upload Inspection Reports'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Drag and drop your PDF inspection reports here, or click to browse files
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button
              variant="default"
              iconName="FolderOpen"
              iconPosition="left"
              disabled={isUploading}
              loading={isUploading}
            >
              Browse Files
            </Button>
            
            <div className="text-xs text-muted-foreground">
              Supported formats: {acceptedTypes?.join(', ')} • Max size: 10MB per file
            </div>
          </div>
        </div>
        
        {isUploading && (
          <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin">
                <Icon name="Loader2" size={24} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Uploading files...</span>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <div className="flex items-center space-x-1">
          <Icon name="Shield" size={12} />
          <span>Secure upload</span>
        </div>
        <div className="flex items-center space-x-1">
          <Icon name="Zap" size={12} />
          <span>Fast processing</span>
        </div>
        <div className="flex items-center space-x-1">
          <Icon name="Lock" size={12} />
          <span>Private & confidential</span>
        </div>
      </div>
    </div>
  );
};

export default FileUploadZone;
