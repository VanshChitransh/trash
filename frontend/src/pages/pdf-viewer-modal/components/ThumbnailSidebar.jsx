import React from 'react';

import Button from '../../../components/ui/Button';

const ThumbnailSidebar = ({ 
  isOpen, 
  onToggle, 
  currentPage = 1, 
  totalPages = 10, 
  onPageSelect 
}) => {
  // Mock thumbnail data
  const thumbnails = Array.from({ length: totalPages }, (_, i) => ({
    id: i + 1,
    pageNumber: i + 1,
    thumbnail: `https://picsum.photos/120/160?random=${i + 1}`,
    title: i + 1 === 1 ? 'Executive Summary' : 
           i + 1 === 2 ? 'Electrical Systems' :
           i + 1 === 3 ? 'Plumbing Systems' :
           i + 1 === 4 ? 'HVAC Systems' :
           i + 1 === 5 ? 'Roofing & Exterior' :
           `Page ${i + 1}`
  }));

  return (
    <>
      {/* Toggle Button - Mobile */}
      <div className="lg:hidden fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <Button
          variant="default"
          size="sm"
          iconName={isOpen ? "ChevronLeft" : "ChevronRight"}
          onClick={onToggle}
          className="shadow-moderate"
        />
      </div>
      {/* Sidebar */}
      <div className={`
        fixed lg:relative top-0 left-0 h-full bg-card border-r border-border z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-64 lg:w-56
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Pages</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconName="X"
              onClick={onToggle}
              className="lg:hidden"
            />
          </div>
        </div>

        {/* Thumbnails List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {thumbnails?.map((thumb) => (
              <button
                key={thumb?.id}
                onClick={() => onPageSelect(thumb?.pageNumber)}
                className={`
                  w-full p-2 rounded-lg border-2 transition-all duration-200
                  ${currentPage === thumb?.pageNumber 
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <div className="space-y-2">
                  {/* Thumbnail Image */}
                  <div className="relative">
                    <img
                      src={thumb?.thumbnail}
                      alt={`Page ${thumb?.pageNumber}`}
                      className="w-full h-20 object-cover rounded border bg-muted"
                      loading="lazy"
                    />
                    {/* Page Number Overlay */}
                    <div className="absolute top-1 right-1 bg-background/90 text-foreground text-xs px-1.5 py-0.5 rounded">
                      {thumb?.pageNumber}
                    </div>
                  </div>
                  
                  {/* Page Title */}
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground truncate">
                      {thumb?.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Page {thumb?.pageNumber}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border">
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              iconName="Download"
              iconPosition="left"
            >
              Download All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              iconName="Printer"
              iconPosition="left"
            >
              Print Pages
            </Button>
          </div>
        </div>
      </div>
      {/* Overlay for Mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default ThumbnailSidebar;