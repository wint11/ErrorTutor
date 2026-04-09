'use client'

import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, message, Upload, TreeSelect } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { teacherApi } from '@/lib/api'
import axios from 'axios'

const { Option } = Select

export default function TeacherExercises() {
  const [exercises, setExercises] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [knowledgeTree, setKnowledgeTree] = useState<any[]>([])
  const [version, setVersion] = useState('zhejiang')
  const [grade, setGrade] = useState('7a')
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [exRes, clsRes] = await Promise.all([
        teacherApi.getExercises(),
        teacherApi.getClasses()
      ])
      setExercises(exRes.data)
      setClasses(clsRes.data)
    } catch (error) {
      message.error('数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchKnowledgeTree = async (v: string, g: string) => {
    try {
      const res = await axios.get(`/api/knowledge/tree?version=${v}&grade=${g}`)
      // Convert the data structure to Ant Design TreeSelect format
      const formatTree = (nodes: any[]): any[] => {
        return nodes.map(node => ({
          title: node.title,
          value: node.title, // Using title as value to store in DB
          children: node.children ? formatTree(node.children) : undefined
        }))
      }
      setKnowledgeTree(formatTree(res.data))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchKnowledgeTree(version, grade)
  }, [version, grade])

  const handleCreate = async (values: any) => {
    try {
      await teacherApi.createExercise({
        title: values.title,
        content: values.content,
        classIds: values.classIds,
        knowledgePoint: values.knowledgePoint,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null
      })
      message.success('发布练习成功')
      setModalVisible(false)
      form.resetFields()
      fetchData()
    } catch (error) {
      message.error('发布失败')
    }
  }

  const columns = [
    { title: '练习标题', dataIndex: 'title', key: 'title' },
    { title: '题目内容', dataIndex: 'content', key: 'content', render: (t: string) => t.length > 20 ? t.slice(0, 20) + '...' : t },
    { title: '关联知识点', dataIndex: 'knowledgePoint', key: 'knowledgePoint', render: (t: string) => t || '无' },
    { title: '发布班级', dataIndex: ['class', 'name'], key: 'className' },
    { title: '提交人数', dataIndex: ['_count', 'submissions'], key: 'submissions' },
    { title: '截止日期', dataIndex: 'dueDate', key: 'dueDate', render: (t: string) => t ? new Date(t).toLocaleDateString() : '无' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t: string) => new Date(t).toLocaleDateString() },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">练习管理</h1>
            <p className="text-slate-500 mt-1 mb-0">在这里为您管理的班级发布新的练习题，并查看练习的提交情况。</p>
          </div>
          <Button type="primary" size="large" onClick={() => setModalVisible(true)} className="bg-blue-600 rounded-xl font-medium shadow-md shadow-blue-200">
            发布新练习
          </Button>
        </div>

        <Card className="rounded-2xl shadow-sm border-slate-100 min-h-[500px]">
          <Table 
            columns={columns} 
            dataSource={exercises} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10, className: 'mt-6' }}
          />
        </Card>

        <Modal
        title="发布新练习"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} className="mt-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <Form.Item name="title" label="练习标题" rules={[{ required: true, message: '请输入标题' }]} className="col-span-2">
              <Input placeholder="例如：一元二次方程周测" size="large" />
            </Form.Item>
            
            <Form.Item name="classIds" label="目标班级" rules={[{ required: true, message: '请选择班级' }]}>
              <Select 
                mode="multiple" 
                placeholder="请选择要发布的班级" 
                size="large"
                maxTagCount="responsive"
                allowClear
              >
                {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="dueDate" label="截止日期">
              <DatePicker className="w-full" placeholder="请选择截止日期（可选）" size="large" />
            </Form.Item>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
            <div className="font-medium text-slate-700 mb-3 flex items-center">
              <span className="w-1 h-4 bg-blue-500 rounded mr-2"></span>
              知识点绑定 <span className="text-slate-400 text-xs ml-2 font-normal">（选填，帮助学生精准复习）</span>
            </div>
            <div className="flex gap-3 items-start">
              <Select value={version} onChange={setVersion} className="w-1/4" size="large">
                <Option value="renjiao">人教版</Option>
                <Option value="zhejiang">浙教版</Option>
              </Select>
              <Select value={grade} onChange={setGrade} className="w-1/4" size="large">
                <Option value="7a">初一上</Option>
                <Option value="7b">初一下</Option>
                <Option value="8a">初二上</Option>
                <Option value="8b">初二下</Option>
                <Option value="9a">初三上</Option>
                <Option value="9b">初三下</Option>
              </Select>
              <Form.Item name="knowledgePoint" className="mb-0 flex-1">
                <TreeSelect
                  showSearch
                  size="large"
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                  placeholder="请搜索并选择知识点"
                  allowClear
                  treeData={knowledgeTree}
                />
              </Form.Item>
            </div>
          </div>

          <Form.Item 
            name="content" 
            label="题目内容"
            rules={[{ required: true, message: '请输入题目内容' }]}
            extra={
              <div className="mt-2 text-right">
                <Upload 
                  accept=".md" 
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const reader = new FileReader()
                    reader.onload = (e) => {
                      const text = e.target?.result as string
                      form.setFieldsValue({ content: text })
                      message.success(`${file.name} 导入成功`)
                    }
                    reader.readAsText(file)
                    return false
                  }}
                >
                  <Button type="dashed" icon={<UploadOutlined />}>从 Markdown 文件导入</Button>
                </Upload>
              </div>
            }
          >
            <Input.TextArea rows={8} placeholder="请输入具体的练习题目要求，或通过下方按钮导入 Markdown 文件..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  </div>
  )
}
