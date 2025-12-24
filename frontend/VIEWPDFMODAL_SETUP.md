# ViewPdfModal Setup Guide

## Overview

The `ViewPdfModal` component provides an accessible, feature-rich modal for previewing PDF files stored in Cloudflare R2 through a Worker preview proxy.

## Environment Variable Configuration

Set **one** of the following environment variables based on your build system:

### For Vite (Current Project)
Create or update `.env.local` in the `Frontend/frontend/` directory:
```bash
VITE_PREVIEW_BASE_URL=https://small-forest-1400.arcinspectiongroup.workers.dev
```

**Note:** The component has a fallback default URL configured. However, for production, you should always set the environment variable.

### For Next.js
```bash
NEXT_PUBLIC_PREVIEW_BASE_URL=https://preview-proxy.your-domain.workers.dev
```

### For Create React App (CRA)
```bash
REACT_APP_PREVIEW_BASE_URL=https://preview-proxy.your-domain.workers.dev
```

## Cloudflare Worker Requirements

Your Worker proxy must:
- Return files with `Content-Disposition: inline` header
- Set correct `Content-Type: application/pdf` header
- Support byte-range requests (for partial content)
- Accept the R2 object key as the URL path (e.g., `uploads/userId/file.pdf`)

## Usage Example

```jsx
import ViewPdfModal from './components/ViewPdfModal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const fileUrl = 'https://pub-d3c1eee4bc224534bbabe0e23f965691.r2.dev/uploads/userId/file.pdf';
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>View PDF</button>
      
      <ViewPdfModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        fileUrl={fileUrl}
        title="My Document"
        downloadFileName="document.pdf"
        height={700}
        width={900}
      />
    </>
  );
}
```

## Component Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `open` | boolean | Yes | - | Controls modal visibility |
| `onClose` | function | Yes | - | Callback when modal should close |
| `fileKey` | string | No* | - | R2 object key (e.g., "uploads/userId/file.pdf") |
| `fileUrl` | string | No* | - | Full file URL (fileKey will be extracted) |
| `title` | string | No | - | Modal header title (defaults to filename) |
| `downloadFileName` | string | No | - | Filename for download (defaults to fileKey basename) |
| `height` | number | No | 700 | Modal height in pixels |
| `width` | number | No | 900 | Modal width in pixels |
| `onOpened` | function | No | - | Callback when modal opens |
| `onLoaded` | function | No | - | Callback when PDF loads successfully |
| `onError` | function | No | - | Callback when PDF fails to load |
| `onClosed` | function | No | - | Callback when modal closes |

*Either `fileKey` or `fileUrl` must be provided.

## Features

- ✅ **Accessibility**: Full keyboard navigation, focus trapping, ARIA labels, screen reader support
- ✅ **Error Handling**: Network errors, timeouts, missing files, configuration errors
- ✅ **Loading States**: Visual loading indicator with 10-second timeout
- ✅ **Security**: Path traversal prevention, safe URL encoding
- ✅ **Responsive**: Works on mobile and desktop
- ✅ **Actions**: Open in new tab, download, close
- ✅ **Retry**: Automatic retry on failure
- ✅ **Performance**: Optimized re-renders, GPU-friendly transforms

## Testing Checklist

- [ ] Set environment variable in `.env.local`
- [ ] Verify Worker proxy is reachable from browser
- [ ] Test with a valid fileKey from R2
- [ ] Test keyboard navigation (Tab, Shift+Tab, Escape)
- [ ] Test on mobile viewport
- [ ] Test error states (network failure, timeout, 404)
- [ ] Test "Open in new tab" action
- [ ] Test "Download" action
- [ ] Test closing via backdrop click, Escape key, and close button

## Troubleshooting

### "Configuration Required" Error
- Ensure environment variable is set correctly
- Restart dev server after setting env var
- Check variable name matches your build system (VITE_* for Vite, etc.)

### PDF Not Loading
- Verify Worker proxy URL is correct and reachable
- Check browser console for CORS errors
- Verify fileKey format matches R2 object key exactly
- Check Worker logs for errors

### Timeout Errors
- Large PDFs may take longer than 10 seconds
- Check network connection
- Consider increasing Worker timeout if needed

