import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Space, Tabs, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import AssetSearch from '../components/AssetSearch';
import { getCurrentUserId } from '../utils/auth';

const StockList = () => {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [platforms, setPlatforms] = useState([]);
    const [form] = Form.useForm();
    
    // Chart related
    const [selectedStock, setSelectedStock] = useState(null);
    const [chartModalOpen, setChartModalOpen] = useState(false);
    const [chartPeriod, setChartPeriod] = useState('min'); // min, day, week, month
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);

    const fetchStocks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const userId = getCurrentUserId();
            const res = await axios.get(`/api/stocks?userId=${userId}`);
            setStocks(res.data);
        } catch (error) {
            if (!silent) message.error('获取持仓失败');
        }
        if (!silent) setLoading(false);
    };

    const fetchPlatforms = async () => {
        const userId = getCurrentUserId();
        const res = await axios.get(`/api/platforms?userId=${userId}`);
        setPlatforms(res.data);
    };

    useEffect(() => {
        fetchStocks();
        fetchPlatforms();

        const interval = setInterval(() => {
            fetchStocks(true);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // Fetch Chart Data
    useEffect(() => {
        if (selectedStock && chartModalOpen) {
            const fetchChart = async () => {
                setChartLoading(true);
                try {
                    const res = await axios.get(`/api/history/detailed?code=${selectedStock.stock_code}&period=${chartPeriod}`);
                    setChartData(res.data);
                } catch (e) {
                    console.error(e);
                }
                setChartLoading(false);
            };
            fetchChart();
        }
    }, [selectedStock, chartModalOpen, chartPeriod]);

    const handleAdd = async (values) => {
        try {
            const userId = getCurrentUserId();
            await axios.post('/api/stocks', { ...values, userId: userId });
            message.success('添加成功');
            setIsModalOpen(false);
            form.resetFields();
            fetchStocks();
        } catch (error) {
            message.error('添加失败');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/stocks/${id}`);
            message.success('删除成功');
            fetchStocks();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const onAssetSelect = (item) => {
        form.setFieldsValue({
            code: item.code,
            name: item.name
        });
    };

    const columns = [
        {
            title: '代码/名称',
            dataIndex: 'stock_code',
            render: (text, record) => (
                <div 
                    className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                    onClick={() => {
                        setSelectedStock(record);
                        setChartPeriod('min'); 
                        setChartModalOpen(true);
                    }}
                >
                    <div className="font-bold text-blue-600">{record.stock_name}</div>
                    <div className="text-gray-400 text-xs">{text}</div>
                </div>
            ),
        },
        {
            title: '现价/成本',
            dataIndex: 'current_price',
            render: (text, record) => (
                <div>
                    <div className="font-bold">¥{text}</div>
                    <div className="text-gray-400 text-xs">成本: {record.cost_price}</div>
                </div>
            ),
        },
        {
            title: '持仓/仓位',
            dataIndex: 'quantity',
            render: (text, record) => (
                <div>
                    <div className="font-bold">{text} 股</div>
                    <div className="text-blue-500 text-xs">{(record.market_value / 1000).toFixed(1)}%</div>
                </div>
            ),
        },
        {
            title: '当日涨跌',
            dataIndex: 'daily_percent',
            render: (text) => (
                <span className={text > 0 ? 'text-red-500' : 'text-green-500'}>
                    {text > 0 ? '+' : ''}{text}%
                </span>
            ),
        },
        {
            title: '当日盈亏',
            dataIndex: 'daily_pnl',
            render: (text) => (
                <span className={text > 0 ? 'text-red-500' : 'text-green-500'}>
                    {text > 0 ? '+' : ''}{text.toFixed(2)}
                </span>
            ),
        },
        {
            title: '累计盈亏',
            dataIndex: 'total_pnl',
            render: (text) => (
                <span className={text > 0 ? 'text-red-500' : 'text-green-500'}>
                    {text > 0 ? '+' : ''}{text.toFixed(2)}
                </span>
            ),
        },
        {
            title: '所属平台',
            dataIndex: 'platform_name',
            render: (text) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                        // TODO: Implement Edit
                        message.info('编辑功能开发中');
                    }} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                </Space>
            ),
        },
    ];

    const getChartOption = () => {
        if (!selectedStock || !chartData.length) return {};
        
        const isMin = chartPeriod === 'min';
        const dates = chartData.map(d => d.date);
        
        let series = [];
        let xAxis = { type: 'category', data: dates };
        let yAxis = { scale: true };
        let tooltip = { trigger: 'axis' };

        if (isMin) {
             // Line Chart for Min
             series = [{
                 data: chartData.map(d => d.close),
                 type: 'line',
                 smooth: true,
                 areaStyle: { opacity: 0.1 },
                 itemStyle: { color: '#1890ff' }
             }];
        } else {
             // K-Line (Candlestick) for Day/Week/Month
             // ECharts Candlestick: [open, close, low, high]
             // Note: ECharts expects [open, close, low, high] (OCLH) or [open, close, lowest, highest]
             // My API returns { open, close, high, low }
             const kData = chartData.map(d => [d.open, d.close, d.low, d.high]);
             series = [{
                 type: 'candlestick',
                 data: kData,
                 itemStyle: {
                     color: '#ef232a', // Up color (Red)
                     color0: '#14b143', // Down color (Green)
                     borderColor: '#ef232a',
                     borderColor0: '#14b143'
                 }
             }];
        }

        return {
            title: { text: `${selectedStock.stock_name} (${chartPeriod === 'min' ? '分时' : chartPeriod})` },
            tooltip: tooltip,
            xAxis: xAxis,
            yAxis: yAxis,
            grid: { left: '5%', right: '5%', bottom: '15%' },
            dataZoom: isMin ? [] : [{ type: 'inside' }, { type: 'slider', bottom: '5%' }],
            series: series
        };
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">股票持仓明细</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>新增股票</Button>
            </div>
            <Table columns={columns} dataSource={stocks} rowKey="id" loading={loading} />

            <Modal title="新增股票" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
                <Form form={form} onFinish={handleAdd} layout="vertical">
                    <Form.Item name="platformId" label="所属平台" rules={[{ required: true }]}>
                        <Select>
                            {platforms.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item label="搜索股票 (输入代码或名称)">
                        <AssetSearch 
                            placeholder="例如: 600519 或 茅台" 
                            onSelect={onAssetSelect}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item name="code" label="股票代码" rules={[{ required: true }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item name="name" label="股票名称" rules={[{ required: true }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item name="cost" label="成本价" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} prefix="¥" />
                    </Form.Item>
                    <Form.Item name="quantity" label="持仓股数" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" className="w-full">提交</Button>
                </Form>
            </Modal>

            <Modal 
                title={null} 
                open={chartModalOpen} 
                onCancel={() => setChartModalOpen(false)} 
                footer={null} 
                width={900}
                bodyStyle={{ padding: '20px' }}
            >
                <Tabs 
                    activeKey={chartPeriod} 
                    onChange={setChartPeriod}
                    items={[
                        { label: '分时', key: 'min' },
                        { label: '日K', key: 'day' },
                        { label: '周K', key: 'week' },
                        { label: '月K', key: 'month' },
                    ]}
                />
                {chartLoading ? (
                    <div className="h-96 flex items-center justify-center"><Spin /></div>
                ) : (
                    selectedStock && <ReactECharts option={getChartOption()} style={{ height: '400px' }} />
                )}
            </Modal>
        </div>
    );
};

export default StockList;
