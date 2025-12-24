import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import AuthGuard from "components/AuthGuard";
import NotFound from "pages/NotFound";
import DashboardOverview from './pages/dashboard-overview';
import AuthenticationHub from './pages/authentication-hub';
import PDFViewerModal from './pages/pdf-viewer-modal';
import EstimateGenerationResults from './pages/estimate-generation-results';
import FileUploadManagement from './pages/file-upload-management';
import LandingPage from './pages/landing-page';
import Accounts from './pages/accounts';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthGuard>
          <ScrollToTop />
          <RouterRoutes>
            {/* Define your route here */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard-overview" element={<DashboardOverview />} />
            <Route path="/authentication-hub" element={<AuthenticationHub />} />
            <Route path="/pdf-viewer-modal" element={<PDFViewerModal />} />
            <Route path="/estimate-generation-results" element={<EstimateGenerationResults />} />
            <Route path="/file-upload-management" element={<FileUploadManagement />} />
            <Route path="/landing-page" element={<LandingPage />} />
            <Route path="/account" element={<Accounts />} />
            <Route path="*" element={<NotFound />} />
          </RouterRoutes>
        </AuthGuard>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
