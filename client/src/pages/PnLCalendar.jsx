import React, { useEffect, useState } from 'react';
import { Calendar, Badge, Card, Row, Col, Statistic, Spin, message } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import { getCurrentUserId } from '../utils/auth';

const PnLCalendar = () => {
    const [pnlData, setPnlData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCalendar = async () => {
            try {
                const userId = getCurrentUserId();
                const res = await axios.get(`/api/calendar?userId=${userId}`);
                setPnlData(res.data);
            } catch (error) {
                message.error('获取盈亏日历失败');
            } finally {
                setLoading(false);
            }
        };
        fetchCalendar();
    }, []);

    const getListData = (value) => {
        const dateStr = value.format('YYYY-MM-DD');
        const dayData = pnlData.find(d => d.date === dateStr);
        
        if (!dayData) return [];

        return [
            { 
                type: dayData.value > 0 ? 'success' : 'error', 
                content: dayData.value > 0 ? `+${dayData.value}` : `${dayData.value}` 
            }
        ];
    };

    const dateCellRender = (value) => {
        const listData = getListData(value);
        return (
            <ul className="events p-0 list-none">
                {listData.map((item) => (
                    <li key={item.content}>
                        <span className={`text-xs font-bold ${item.type === 'success' ? 'text-red-500' : 'text-green-500'}`}>
                            {item.content}
                        </span>
                    </li>
                ))}
            </ul>
        );
    };

    if (loading) return <Spin />;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">盈亏日历 (基于持仓历史模拟)</h2>
            <div className="bg-white p-4 rounded shadow">
                <Calendar dateCellRender={dateCellRender} />
            </div>
        </div>
    );
};

export default PnLCalendar;
