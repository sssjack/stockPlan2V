import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, List, Tag, Spin } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import { getCurrentUserId } from '../utils/auth';
import useIsMobile from '../hooks/useIsMobile';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_asset: 0,
    daily_pnl: 0,
    total_pnl: 0,
    total_pnl_percent: 0
  });
  const [platformData, setPlatformData] = useState([]);
  const [historyData, setHistoryData] = useState({ dates: [], values: [] });
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchData = async (silent = false) => {
      try {
        const userId = getCurrentUserId();
        // Only fetch history once initially (or rarely) as it's heavy and historical
        const promises = [
          axios.get(`/api/dashboard?userId=${userId}`),
          axios.get(`/api/platforms?userId=${userId}`)
        ];
        if (!silent) promises.push(axios.get(`/api/asset-history?userId=${userId}`));

        const results = await Promise.all(promises);
        const dashRes = results[0];
        const platRes = results[1];
        const histRes = !silent ? results[2] : null;
        
        setStats(dashRes.data);
        
        const platforms = platRes.data.map(p => ({
          title: p.name,
          value: p.total_value,
          percent: dashRes.data.total_asset > 0 ? ((p.total_value / dashRes.data.total_asset) * 100).toFixed(1) : 0
        }));
        setPlatformData(platforms);

        if (histRes) {
            setHistoryData({
                dates: histRes.data.map(d => d.date),
                values: histRes.data.map(d => d.value)
            });
        }

      } catch (err) {
        console.error(err);
      }
      if (!silent) setLoading(false);
    };
    
    fetchData();

    const interval = setInterval(() => {
        fetchData(true);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const chartOption = {
    title: { text: '资产走势 (近30日)' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: historyData.dates },
    yAxis: { type: 'value', min: 'dataMin' }, // Auto scale
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    series: [{ 
        data: historyData.values, 
        type: 'line', 
        smooth: true, 
        areaStyle: {
            color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: 'rgba(24, 144, 255, 0.3)' }, { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }]
            }
        },
        itemStyle: { color: '#1890ff' }
    }]
  };

  if (loading) return <Spin size="large" className="flex justify-center mt-20" />;

  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} className="bg-blue-50">
            <Statistic
              title="总资产 (CNY)"
              value={stats.total_asset}
              precision={2}
              valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
              suffix={<span className="text-xs text-blue-500 ml-2">{(stats.total_pnl_percent).toFixed(2)}% (持仓总盈亏)</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="bg-green-50">
            <Statistic
              title="今日盈亏"
              value={stats.daily_pnl}
              precision={2}
              valueStyle={{ color: stats.daily_pnl > 0 ? '#cf1322' : '#3f8600', fontWeight: 'bold' }}
              prefix={stats.daily_pnl > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix={!isMobile && <span className="text-xs text-gray-500 ml-2">当日波动</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="bg-purple-50">
            <Statistic
              title="持仓平台数"
              value={platformData.length}
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
              suffix={!isMobile && <span className="text-xs text-gray-500 ml-2">已配置多维度理财</span>}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={16}>
          <Card title="资产走势" bordered={false}>
            <ReactECharts option={chartOption} style={{ height: isMobile ? 300 : 400 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card title="平台资产分布" bordered={false}>
            <List
              itemLayout="horizontal"
              dataSource={platformData}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<div className="w-1 h-8 bg-blue-600 rounded"></div>}
                    title={item.title}
                    description={`占比: ${item.percent}%`}
                  />
                  <div className="text-right">
                    <div className="font-bold">¥{item.value.toLocaleString()}</div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
