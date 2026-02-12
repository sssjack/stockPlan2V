import React, { useState, useEffect } from 'react';
import { List, Input, Button, message, Popconfirm } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import { getCurrentUserId } from '../utils/auth';

const PlatformList = () => {
    const [platforms, setPlatforms] = useState([]);
    const [newPlatform, setNewPlatform] = useState('');

    const fetchPlatforms = async () => {
        const userId = getCurrentUserId();
        const res = await axios.get(`/api/platforms?userId=${userId}`);
        setPlatforms(res.data);
    };

    useEffect(() => {
        fetchPlatforms();
    }, []);

    const handleAdd = async () => {
        if (!newPlatform) return;
        try {
            const userId = getCurrentUserId();
            await axios.post('/api/platforms', { userId: userId, name: newPlatform });
            message.success('添加成功');
            setNewPlatform('');
            fetchPlatforms();
        } catch (error) {
            message.error('添加失败');
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/platforms/${id}`);
            message.success('删除成功');
            fetchPlatforms();
        } catch (error) {
            message.error(error.response?.data?.error || '删除失败');
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4">平台管理</h2>
            <div className="flex gap-2 mb-4">
                <Input 
                    placeholder="输入新平台名称 (如: 招商银行, 雪球)" 
                    value={newPlatform} 
                    onChange={e => setNewPlatform(e.target.value)} 
                    onPressEnter={handleAdd}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加</Button>
            </div>
            <List
                bordered
                dataSource={platforms}
                renderItem={(item) => (
                    <List.Item actions={[
                        <Popconfirm title="确定删除吗?" onConfirm={() => handleDelete(item.id)}>
                            <Button danger type="text" icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                    ]}>
                        <List.Item.Meta
                            title={item.name}
                            description={`当前资产总值: ¥${item.total_value ? item.total_value.toFixed(2) : '0.00'}`}
                        />
                    </List.Item>
                )}
            />
        </div>
    );
};

export default PlatformList;
