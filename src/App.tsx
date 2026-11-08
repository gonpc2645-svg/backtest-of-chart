import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { ScrollAndMetaManager } from './components/layout/ScrollAndMetaManager';
import { BacktestSetupPage } from './pages/BacktestSetupPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfUsePage } from './pages/TermsOfUsePage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollAndMetaManager />
      <div className="app-shell">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/backtest" element={<BacktestSetupPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfUsePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
