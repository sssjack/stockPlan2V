import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import StockList from './pages/StockList';
import FundList from './pages/FundList';
import Watchlist from './pages/Watchlist';
import PlatformList from './pages/PlatformList';
import PnLCalendar from './pages/PnLCalendar';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [currentTheme, setCurrentTheme] = useState('light');

  const getThemeConfig = () => {
    switch (currentTheme) {
      case 'dark':
        return { 
            algorithm: theme.darkAlgorithm,
            token: { colorPrimary: '#1677ff' } 
        };
      case 'blue':
        return { 
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#1890ff' } 
        };
      case 'green':
        return { 
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#52c41a' } 
        };
      case 'purple':
        return { 
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#722ed1' } 
        };
      default:
        return { 
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#1677ff' } 
        };
    }
  };

  return (
    <ConfigProvider theme={getThemeConfig()}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout currentTheme={currentTheme} setCurrentTheme={setCurrentTheme} />}>
              <Route index element={<Dashboard />} />
              <Route path="stocks" element={<StockList />} />
              <Route path="funds" element={<FundList />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="platforms" element={<PlatformList />} />
              <Route path="calendar" element={<PnLCalendar />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
