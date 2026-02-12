
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Avatar, message } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { getCurrentUserId } from '../utils/auth';

const Profile = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({});

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const userId = getCurrentUserId();
      const res = await axios.get(`/api/users/${userId}`);
      setUser(res.data);
      form.setFieldsValue({
        nickname: res.data.nickname,
        avatar: res.data.avatar,
        username: res.data.username
      });
    } catch (error) {
      console.error(error);
      // message.error('获取用户信息失败'); // Fail silently if endpoint not ready
    }
  };

  const onFinish = async (values) => {
    // Validation: If new password is provided, old password is required
    if (values.password && !values.oldPassword) {
        message.error('请输入当前密码以确认修改');
        return;
    }

    setLoading(true);
    try {
      const userId = getCurrentUserId();
      await axios.put(`/api/users/${userId}`, values);
      message.success('更新成功');
      // If password was changed, clear fields
      if (values.password) {
          form.setFieldsValue({ oldPassword: '', password: '' });
      }
      fetchUser(); // Refresh local state
      // Force refresh layout user info
      window.dispatchEvent(new Event('userUpdated'));
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
          message.error(error.response.data.message);
      } else {
          message.error('更新失败');
      }
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card title="个人设置" bordered={false}>
        <div className="flex flex-col items-center mb-8">
          {user.avatar ? (
             <Avatar size={100} src={user.avatar} />
          ) : (
             <Avatar size={100} icon={<UserOutlined />} className="bg-blue-500" />
          )}
          <div className="mt-4 text-xl font-bold">{user.username || 'Loading...'}</div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ nickname: '', avatar: '' }}
        >
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input size="large" />
          </Form.Item>

          <Form.Item
            name="avatar"
            label="头像链接 (URL)"
            help="请输入图片地址，支持 http/https"
          >
            <Input size="large" prefix={<UploadOutlined />} placeholder="https://example.com/avatar.png" />
          </Form.Item>

          <Form.Item
            name="oldPassword"
            label="当前密码"
            help="修改密码时必填"
          >
            <Input.Password size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="新密码"
            help="留空则不修改密码"
          >
            <Input.Password size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={loading} block>
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Profile;
