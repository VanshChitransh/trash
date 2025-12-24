import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import FileItem from './FileItem';

const FileList = ({
  files = [],
  onFileDelete,
  onFileView,
  onFileDownload,
  onBulkDelete,
  onBulkDownload,
  onEstimate,
  fileWaitPeriods = {}
}) => {
  // Debug: Log files prop changes
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('📦 FileList received files prop:', files?.length || 0, 'files');
      if (files && files.length > 0) {
        console.log('📄 First file:', files[0]?.name, files[0]?.id);
      }
    }
  }, [files]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid'); // 'list' or 'grid'

  const sortOptions = [
    { value: 'date', label: 'Upload Date' },
    { value: 'name', label: 'File Name' },
    { value: 'size', label: 'File Size' },
    { value: 'status', label: 'Status' }
  ];

  const filteredAndSortedFiles = useMemo(() => {
    if (!files || files.length === 0) {
      return [];
    }
    
    let filtered = files.filter(file => {
      if (!file || !file.name) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ File missing name:', file);
        }
        return false;
      }
      return file.name.toLowerCase().includes(searchQuery?.toLowerCase() || '');
    });

    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a?.name?.toLowerCase() || '';
          bValue = b?.name?.toLowerCase() || '';
          break;
        case 'size':
          aValue = a?.size || 0;
          bValue = b?.size || 0;
          break;
        case 'status':
          aValue = a?.status || '';
          bValue = b?.status || '';
          break;
        case 'date':
        default:
          aValue = a?.uploadDate ? new Date(a.uploadDate) : new Date(0);
          bValue = b?.uploadDate ? new Date(b.uploadDate) : new Date(0);
          break;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    if (import.meta.env.DEV) {
      console.log('🔍 FileList - Filtered files:', filtered.length, 'of', files.length);
      if (filtered.length !== files.length && searchQuery) {
        console.log('ℹ️ Search query active:', searchQuery);
      }
    }

    return filtered;
  }, [files, searchQuery, sortBy, sortOrder]);

  const handleSelectAll = () => {
    if (selectedFiles?.size === filteredAndSortedFiles?.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredAndSortedFiles.map(file => file.id)));
    }
  };

  const handleFileSelect = (fileId, isSelected) => {
    const newSelected = new Set(selectedFiles);
    if (isSelected) {
      newSelected?.add(fileId);
    } else {
      newSelected?.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleBulkAction = (action) => {
    const selectedFileIds = Array.from(selectedFiles);
    if (action === 'delete') {
      onBulkDelete(selectedFileIds);
    } else if (action === 'download') {
      onBulkDownload(selectedFileIds);
    }
    setSelectedFiles(new Set());
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  if (files?.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Icon name="FileText" size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No files uploaded yet</h3>
        <p className="text-muted-foreground">Upload your first inspection report to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-md">
          <Input
            type="search"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value)}
            className="w-full"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            options={sortOptions}
            value={sortBy}
            onChange={setSortBy}
            placeholder="Sort by"
            className="w-32"
          />
          
          <Button
            variant="outline"
            size="sm"
            iconName={sortOrder === 'asc' ? 'ArrowUp' : 'ArrowDown'}
            onClick={toggleSortOrder}
          />
          
          <div className="hidden md:flex border-l border-border pl-2 ml-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              iconName="List"
              onClick={() => setViewMode('list')}
            />
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              iconName="Grid3X3"
              onClick={() => setViewMode('grid')}
              className="ml-1"
            />
          </div>
        </div>
      </div>
      {/* Bulk Actions */}
      {selectedFiles?.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium text-foreground">
            {selectedFiles?.size} file{selectedFiles?.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconName="Download"
              onClick={() => handleBulkAction('download')}
            >
              Download
            </Button>
            <Button
              variant="destructive"
              size="sm"
              iconName="Trash2"
              onClick={() => handleBulkAction('delete')}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
      {/* File List Header */}
      <div className="hidden lg:grid grid-cols-[32px_1fr_100px_100px_140px_140px] gap-4 items-center p-3 bg-muted rounded-lg text-sm font-medium text-muted-foreground">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedFiles?.size === filteredAndSortedFiles?.length && filteredAndSortedFiles?.length > 0}
            onChange={handleSelectAll}
            className="rounded border-border"
          />
        </div>
        <div className="flex items-center">File Name</div>
        <div className="flex items-center justify-center">Status</div>
        <div className="flex items-center justify-center">Size</div>
        <div className="flex items-center justify-center">Upload Date</div>
        <div className="flex items-center justify-center">Actions</div>
      </div>
      {/* File Items */}
      <div className={viewMode === 'grid' ?'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' :'space-y-2'
      }>
        {filteredAndSortedFiles && filteredAndSortedFiles.length > 0 ? (
          filteredAndSortedFiles.map((file) => (
          <FileItem
            key={file?.id}
            file={file}
            viewMode={viewMode}
            isSelected={selectedFiles?.has(file?.id)}
            onSelect={(isSelected) => handleFileSelect(file?.id, isSelected)}
            onView={() => onFileView(file)}
            onDelete={() => onFileDelete(file?.id)}
            onDownload={() => onFileDownload(file)}
            onEstimate={onEstimate}
            waitPeriod={fileWaitPeriods[file?.id]}
          />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No files found</p>
            {import.meta.env.DEV && (
              <p className="text-xs mt-2">Files in state: {files?.length || 0}</p>
            )}
          </div>
        )}
      </div>
      {/* Results Summary */}
      <div className="text-sm text-muted-foreground text-center pt-4">
        Showing {filteredAndSortedFiles?.length} of {files?.length} files
      </div>
    </div>
  );
};

export default FileList;