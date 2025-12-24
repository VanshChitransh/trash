import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PDFHeader = ({ 
  fileName = "Document.pdf", 
  onClose, 
  onDownload, 
  onShare, 
  onDelete,
  isMenuOpen,
  onMenuToggle 
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-card border-b border-border">
      {/* Left Section - File Info */}
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 bg-error/10 rounded-md">
          <Icon name="FileText" size={16} className="text-error" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-foreground truncate">
            {fileName}
          </h2>
          <p className="text-xs text-muted-foreground">
            PDF Document
          </p>
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center space-x-2">
        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="Download"
            onClick={onDownload}
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconName="Share2"
            onClick={onShare}
          >
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconName="Trash2"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden relative">
          <Button
            variant="ghost"
            size="sm"
            iconName="MoreVertical"
            onClick={onMenuToggle}
          />
          
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-moderate z-50">
              <div className="py-1">
                <button
                  onClick={onDownload}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-smooth"
                >
                  <Icon name="Download" size={16} />
                  <span>Download</span>
                </button>
                <button
                  onClick={onShare}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-smooth"
                >
                  <Icon name="Share2" size={16} />
                  <span>Share</span>
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-destructive hover:bg-muted transition-smooth"
                >
                  <Icon name="Trash2" size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          iconName="X"
          onClick={onClose}
        />
      </div>
    </div>
  );
};

export default PDFHeader;