import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Row, Col, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import AssetSearch from '../components/AssetSearch';
import { getCurrentUserId } from '../utils/auth';

const Watchlist = () => {
    const [items, setItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchWatchlist = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const userId = getCurrentUserId();
            const res = await axios.get(`/api/watchlist?userId=${userId}`);
            setItems(res.data);
        } catch (error) {
            if (!silent) message.error('获取自选失败');
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        fetchWatchlist();
        const interval = setInterval(() => fetchWatchlist(true), 10000);
        return () => clearInterval(interval);
    }, []);
    
    const handleAdd = async (item) => {
        try {
            const userId = getCurrentUserId();
            await axios.post('/api/watchlist', { 
                userId: userId, 
                code: item.code, 
                name: item.name, 
                type: item.type 
            });
            message.success('关注成功');
            setIsModalOpen(false);
            fetchWatchlist();
        } catch (error) {
            message.error(error.response?.data?.error || '添加失败');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/watchlist/${id}`);
            message.success('已取消关注');
            fetchWatchlist();
        } catch (error) {
            message.error('删除失败');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">自选关注 (实时监控)</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>添加关注</Button>
            </div>

            <Row gutter={[16, 16]}>
                {items.map((item) => (
                    <Col span={6} key={item.id}>
                        <Card 
                            hoverable 
                            actions={[
                                <Popconfirm title="确定取消关注吗?" onConfirm={() => handleDelete(item.id)}>
                                    <DeleteOutlined key="delete" className="text-gray-400 hover:text-red-500" />
                                </Popconfirm>
                            ]}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-lg">{item.name}</div>
                                    <div className="text-gray-400 text-xs">{item.code}</div>
                                </div>
                                <div className={`font-bold ${item.change_percent >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {item.change_percent >= 0 ? '+' : ''}{item.change_percent}%
                                </div>
                            </div>
                            <div className="mt-4 text-2xl font-bold">¥{item.current_price?.toFixed(2)}</div>
                            <div className="h-16 mt-2">
                                <ReactECharts 
                                    option={{
                                        xAxis: { show: false, type: 'category' },
                                        yAxis: { show: false, min: 'dataMin' },
                                        grid: { top: 0, bottom: 0, left: 0, right: 0 },
                                        series: [{ 
                                            type: 'line', 
                                            data: item.chartData || [], 
                                            showSymbol: false, 
                                            smooth: true, 
                                            lineStyle: { color: item.change_percent >= 0 ? '#ff4d4f' : '#52c41a' } 
                                        }]
                                    }} 
                                    style={{ height: '60px' }}
                                />
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Modal title="添加自选" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
                <AssetSearch 
                    placeholder="输入代码或名称搜索" 
                    onSelect={handleAdd} 
                    style={{ width: '100%' }}
                />
            </Modal>
        </div>
    );
};

export default Watchlist;
