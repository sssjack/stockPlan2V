import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, theme, Select, Avatar, Dropdown } from 'antd';
import {
  DashboardOutlined,
  StockOutlined,
  FundOutlined,
  EyeOutlined,
  CalendarOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getCurrentUserId } from '../utils/auth';

const { Header, Sider, Content } = Layout;

const MainLayout = ({ currentTheme, setCurrentTheme }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState({ nickname: '用户', avatar: '' });
  const navigate = useNavigate();
  const location = useLocation();

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    // Fetch user info
    const fetchUser = async () => {
        try {
            const userId = getCurrentUserId();
            const res = await axios.get(`/api/users/${userId}`);
            setUser(res.data);
        } catch (e) {
            console.error('Failed to fetch user', e);
            if (e.response && e.response.status === 404) {
                // User not found or not logged in properly?
                // navigate('/login');
            }
        }
    };
    fetchUser();
  }, [location.pathname]); // Refresh when route changes (e.g. after profile edit)

  const handleLogout = () => {
      localStorage.removeItem('isAuthenticated');
      navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '资产总览',
    },
    {
      key: '/stocks',
      icon: <StockOutlined />,
      label: '持仓股票',
    },
    {
      key: '/funds',
      icon: <FundOutlined />,
      label: '我的基金',
    },
    {
      key: '/watchlist',
      icon: <EyeOutlined />,
      label: '自选关注',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: '盈亏日历',
    },
    {
      key: '/platforms',
      icon: <SettingOutlined />,
      label: '平台管理',
    },
  ];

  const themeOptions = [
    { value: 'light', label: '简约白 (默认)' },
    { value: 'dark', label: '极客黑' },
    { value: 'blue', label: '商务蓝' },
    { value: 'green', label: '翡翠绿' },
    { value: 'purple', label: '梦幻紫' },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<ProfileOutlined />} onClick={() => navigate('/profile')}>
        个人设置
      </Menu.Item>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} theme="light" className="border-r border-gray-200">
        <div className="h-16 m-4 flex items-center justify-center font-bold text-xl text-blue-600">
          {!collapsed ? 'WealthWise' : 'WW'}
        </div>
        <Menu
          theme="light"
          defaultSelectedKeys={['/']}
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer }} className="flex justify-between items-center shadow-sm">
          <div className="text-lg font-medium">
            欢迎回来, {user.nickname || user.username}
            <span className="text-xs text-gray-400 ml-2 font-normal">今日数据已实时同步自各大交易所</span>
          </div>
          <div className="flex items-center gap-4">
            <Select
              defaultValue="light"
              value={currentTheme}
              style={{ width: 120 }}
              options={themeOptions}
              onChange={setCurrentTheme}
            />
            <Dropdown overlay={userMenu}>
              <div className="flex items-center cursor-pointer">
                  {user.avatar ? (
                      <Avatar src={user.avatar} />
                  ) : (
                      <Avatar icon={<UserOutlined />} className="bg-blue-500" />
                  )}
                  <span className="ml-2">{user.nickname}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '16px 16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet context={{ currentTheme }} />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
