import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Space, Tabs, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import AssetSearch from '../components/AssetSearch';
import { getCurrentUserId } from '../utils/auth';

const FundList = () => {
    const [funds, setFunds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [platforms, setPlatforms] = useState([]);
    const [form] = Form.useForm();
    
    // Chart related
    const [selectedFund, setSelectedFund] = useState(null);
    const [chartModalOpen, setChartModalOpen] = useState(false);
    const [chartPeriod, setChartPeriod] = useState('day'); // Fund default day, min often empty
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);

    const fetchFunds = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const userId = getCurrentUserId();
            const res = await axios.get(`/api/funds?userId=${userId}`);
            setFunds(res.data);
        } catch (error) {
            if (!silent) message.error('获取基金失败');
        }
        if (!silent) setLoading(false);
    };

    const fetchPlatforms = async () => {
        const userId = getCurrentUserId();
        const res = await axios.get(`/api/platforms?userId=${userId}`);
        setPlatforms(res.data);
    };

    useEffect(() => {
        fetchFunds();
        fetchPlatforms();
        
        const interval = setInterval(() => {
            fetchFunds(true);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    // Fetch Chart Data
    useEffect(() => {
        if (selectedFund && chartModalOpen) {
            const fetchChart = async () => {
                setChartLoading(true);
                try {
                    // Try to fetch fund history. Note: Tencent API might only work for ETF/LOF (sh/sz).
                    // For open-end funds, we rely on the backend trying its best.
                    const res = await axios.get(`/api/history/detailed?code=${selectedFund.fund_code}&period=${chartPeriod}`);
                    setChartData(res.data);
                } catch (e) {
                    console.error(e);
                }
                setChartLoading(false);
            };
            fetchChart();
        }
    }, [selectedFund, chartModalOpen, chartPeriod]);

    const handleAdd = async (values) => {
        try {
            const userId = getCurrentUserId();
            await axios.post('/api/funds', { ...values, userId: userId });
            message.success('添加成功');
            setIsModalOpen(false);
            form.resetFields();
            fetchFunds();
        } catch (error) {
            message.error('添加失败');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/funds/${id}`);
            message.success('删除成功');
            fetchFunds();
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
            title: '基金名称',
            dataIndex: 'fund_name',
            render: (text, record) => (
                <div 
                    className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                    onClick={() => {
                        setSelectedFund(record);
                        setChartPeriod('day'); // Default to Day K
                        setChartModalOpen(true);
                    }}
                >
                    <div className="font-bold text-cyan-600">{text}</div>
                    <div className="text-gray-400 text-xs">{record.fund_code}</div>
                </div>
            ),
        },
        {
            title: '持有金额',
            dataIndex: 'holding_amount',
            render: (text) => <span className="font-bold">¥{parseFloat(text).toLocaleString()}</span>,
        },
        {
            title: '持有收益',
            dataIndex: 'holding_return',
            render: (text) => (
                <span className={text > 0 ? 'text-red-500' : 'text-green-500'}>
                    {text > 0 ? '+' : ''}{parseFloat(text).toLocaleString()}
                </span>
            ),
        },
        {
            title: '收益率',
            dataIndex: 'total_pnl_percent',
            render: (text) => (
                <span className={text > 0 ? 'text-red-500' : 'text-green-500'}>
                    {text > 0 ? '+' : ''}{text.toFixed(2)}%
                </span>
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
            title: '所属平台',
            dataIndex: 'platform_name',
            render: (text) => <Tag color="cyan">{text}</Tag>,
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                         message.info('编辑功能开发中');
                    }} />
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                </Space>
            ),
        },
    ];

    const getChartOption = () => {
        if (!selectedFund || !chartData.length) return {};
        
        const isMin = chartPeriod === 'min';
        const dates = chartData.map(d => d.date);
        
        let series = [];
        let xAxis = { type: 'category', data: dates };
        let yAxis = { scale: true };
        let tooltip = { trigger: 'axis' };

        if (isMin) {
             series = [{
                 data: chartData.map(d => d.close),
                 type: 'line',
                 smooth: true,
                 areaStyle: { opacity: 0.1 },
                 itemStyle: { color: '#13c2c2' }
             }];
        } else {
             // K-Line (Candlestick)
             // Check if it's a flat line (Open == Close for all data points) -> Likely OTC Fund
             const isFlat = chartData.every(d => d.open === d.close && d.high === d.low);

             if (isFlat) {
                 // Render as Line Chart for OTC Funds
                 series = [{
                     data: chartData.map(d => d.close),
                     type: 'line',
                     smooth: true,
                     areaStyle: { opacity: 0.2 },
                     itemStyle: { color: '#1890ff' },
                     lineStyle: { width: 2 }
                 }];
             } else {
                 // Render as Candlestick for ETF/LOF
                 const kData = chartData.map(d => [d.open, d.close, d.low, d.high]);
                 series = [{
                     type: 'candlestick',
                     data: kData,
                     itemStyle: {
                         color: '#ef232a',
                         color0: '#14b143',
                         borderColor: '#ef232a',
                         borderColor0: '#14b143'
                     }
                 }];
             }
        }

        return {
            title: { text: `${selectedFund.fund_name} (${chartPeriod === 'min' ? '分时' : chartPeriod})` },
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
                <h2 className="text-xl font-bold">我的基金组合</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>新增基金</Button>
            </div>
            <Table columns={columns} dataSource={funds} rowKey="id" loading={loading} />

            <Modal title="新增基金" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
                <Form form={form} onFinish={handleAdd} layout="vertical">
                    <Form.Item name="platformId" label="所属平台" rules={[{ required: true }]}>
                        <Select>
                            {platforms.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item label="搜索基金 (输入代码或名称)">
                        <AssetSearch 
                            placeholder="例如: 110011" 
                            onSelect={onAssetSelect}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item name="code" label="基金代码" rules={[{ required: true }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item name="name" label="基金名称" rules={[{ required: true }]}>
                        <Input readOnly />
                    </Form.Item>
                    <Form.Item name="amount" label="持有金额 (现值)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} prefix="¥" />
                    </Form.Item>
                    <Form.Item name="ret" label="持有收益 (总盈亏)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} prefix="¥" />
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
                        { label: '日K', key: 'day' },
                        { label: '周K', key: 'week' },
                        { label: '月K', key: 'month' },
                        { label: '分时', key: 'min' }, // Min might be empty for funds
                    ]}
                />
                {chartLoading ? (
                    <div className="h-96 flex items-center justify-center"><Spin /></div>
                ) : (
                    selectedFund && chartData.length > 0 ? (
                        <ReactECharts option={getChartOption()} style={{ height: '400px' }} />
                    ) : (
                        <div className="h-96 flex items-center justify-center text-gray-400">
                            暂无历史数据 (可能为场外基金或数据源暂不支持)
                        </div>
                    )
                )}
            </Modal>
        </div>
    );
};

export default FundList;
