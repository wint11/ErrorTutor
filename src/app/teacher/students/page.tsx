'use client'

import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Divider } from 'antd'
import { EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { teacherApi } from '@/lib/api'

const { Option } = Select

export default function TeacherStudents() {
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [classModalVisible, setClassModalVisible] = useState(false)
  const [studentModalVisible, setStudentModalVisible] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined)
  const [generatedAccounts, setGeneratedAccounts] = useState<any[]>([])
  const [resultModalVisible, setResultModalVisible] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  
  const [editClassModalVisible, setEditClassModalVisible] = useState(false)
  const [editingClass, setEditingClass] = useState<any>(null)

  const [classForm] = Form.useForm()
  const [editClassForm] = Form.useForm()
  const [studentForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const fetchClasses = async () => {
    try {
      const res = await teacherApi.getClasses()
      setClasses(res.data)
    } catch (error) {
      message.error('获取班级失败')
    }
  }

  const fetchStudents = async (classId?: string) => {
    setLoading(true)
    try {
      const res = await teacherApi.getStudents(classId)
      setStudents(res.data)
    } catch (error) {
      message.error('获取学生失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
    fetchStudents()
  }, [])

  const handleCreateClass = async (values: any) => {
    try {
      await teacherApi.createClass(values.name)
      message.success('班级创建成功')
      setClassModalVisible(false)
      classForm.resetFields()
      fetchClasses()
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleEditClass = async (values: any) => {
    if (!editingClass) return
    try {
      await teacherApi.updateClass(editingClass.id, values.name)
      message.success('班级名称修改成功')
      setEditClassModalVisible(false)
      editClassForm.resetFields()
      fetchClasses()
    } catch (error: any) {
      message.error(error.response?.data?.error || '修改失败')
    }
  }

  const handleDeleteClass = (cls: any) => {
    Modal.confirm({
      title: '确认删除班级',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: (
        <div>
          <p>您确定要删除班级 <strong>{cls.name}</strong> 吗？</p>
          {cls._count.students > 0 && (
            <p className="text-red-500 mt-2">
              注意：该班级内有 <strong>{cls._count.students}</strong> 名学生，删除班级将会<strong>一并删除该班级下的所有学生账号</strong>，此操作不可恢复！
            </p>
          )}
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await teacherApi.deleteClass(cls.id)
          message.success('班级及相关学生已成功删除')
          if (selectedClassId === cls.id) {
            setSelectedClassId(undefined)
            fetchStudents(undefined)
          } else {
            // 如果删除的不是当前选中的班级，但也可能影响了“全部学生”的列表，所以重新获取一下当前列表
            fetchStudents(selectedClassId)
          }
          fetchClasses()
        } catch (error: any) {
          message.error(error.response?.data?.error || '删除失败')
        }
      }
    })
  }

  const handleBatchCreateStudents = async (values: any) => {
    setIsGenerating(true)
    try {
      const res = await teacherApi.batchCreateStudents({
        classId: values.classId,
        count: Number(values.count)
      })
      if (res.data.success) {
        message.success(`成功生成 ${res.data.created} 个学生账号`)
        setGeneratedAccounts(res.data.results)
        setStudentModalVisible(false)
        setResultModalVisible(true)
        studentForm.resetFields()
        fetchStudents(selectedClassId)
        fetchClasses()
      }
    } catch (error) {
      message.error('批量生成失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditStudent = async (values: any) => {
    if (!editingStudent) return
    try {
      await teacherApi.updateStudent(editingStudent.id, {
        username: values.username,
        classId: values.classId,
        password: values.password || undefined
      })
      message.success('修改成功')
      setEditModalVisible(false)
      editForm.resetFields()
      fetchStudents(selectedClassId)
      fetchClasses()
    } catch (error: any) {
      message.error(error.response?.data?.error || '修改失败')
    }
  }

  const handleDeleteStudent = (student: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `您确定要删除学生 ${student.username} 吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await teacherApi.deleteStudent(student.id)
          message.success('删除成功')
          fetchStudents(selectedClassId)
          fetchClasses()
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '班级', dataIndex: ['class', 'name'], key: 'class' },
    { title: '学段', dataIndex: 'grade', key: 'grade' },
    { title: '学力', dataIndex: 'level', key: 'level' },
    { title: '加入时间', dataIndex: 'createdAt', key: 'createdAt', render: (text: string) => new Date(text).toLocaleDateString() },
    { 
      title: '操作', 
      key: 'action', 
      render: (_: any, record: any) => (
        <Space size="middle">
          <a onClick={() => {
            setEditingStudent(record)
            editForm.setFieldsValue({
              username: record.username,
              classId: record.class?.id || selectedClassId,
              password: ''
            })
            setEditModalVisible(true)
          }} className="text-blue-600 hover:text-blue-800">编辑</a>
          <a onClick={() => handleDeleteStudent(record)} className="text-red-600 hover:text-red-800">删除</a>
        </Space>
      ) 
    },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">班级与学生管理</h1>
            <p className="text-slate-500 mt-1 mb-0">在这里管理您的班级，或者通过批量添加功能快速导入学生名单。</p>
          </div>
          <Space>
            <Button type="default" size="large" onClick={() => setClassModalVisible(true)} className="rounded-xl font-medium">新建班级</Button>
            <Button type="primary" size="large" onClick={() => setStudentModalVisible(true)} className="bg-blue-600 rounded-xl font-medium shadow-md shadow-blue-200">一键生成学生账号</Button>
          </Space>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <Card title={<span className="font-bold text-slate-800">我的班级</span>} className="rounded-2xl shadow-sm border-slate-100 h-full">
              <div 
                className={`cursor-pointer px-4 py-3 rounded-xl mb-3 transition-all ${!selectedClassId ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600 font-medium'}`}
                onClick={() => { setSelectedClassId(undefined); fetchStudents(); }}
              >
                全部学生
              </div>
              {classes.map(c => (
                <div 
                  key={c.id}
                  className={`group relative cursor-pointer px-4 py-3 rounded-xl mb-3 transition-all ${selectedClassId === c.id ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600 font-medium'}`}
                  onClick={() => { setSelectedClassId(c.id); fetchStudents(c.id); }}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate pr-2" title={c.name}>{c.name}</span>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs text-slate-500 border border-slate-100 shadow-sm shrink-0">{c._count.students}人</span>
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<EditOutlined />} 
                      className="text-blue-500 hover:text-blue-700 p-0 w-6 h-6 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingClass(c)
                        editClassForm.setFieldsValue({ name: c.name })
                        setEditClassModalVisible(true)
                      }}
                      title="重命名班级"
                    />
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<DeleteOutlined />} 
                      className="text-red-500 hover:text-red-700 p-0 w-6 h-6 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClass(c)
                      }}
                      title="删除班级"
                    />
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div className="md:col-span-3">
            <Card className="rounded-2xl shadow-sm border-slate-100 min-h-[500px]">
              <Table 
                columns={columns} 
                dataSource={students} 
                rowKey="id" 
                loading={loading}
                pagination={{ pageSize: 10, className: 'mt-6' }}
              />
            </Card>
          </div>
        </div>

        {/* 新建班级弹窗 */}
      <Modal
        title="新建班级"
        open={classModalVisible}
        onCancel={() => setClassModalVisible(false)}
        onOk={() => classForm.submit()}
      >
        <Form form={classForm} layout="vertical" onFinish={handleCreateClass}>
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="例如：初一一班" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑班级弹窗 */}
      <Modal
        title="重命名班级"
        open={editClassModalVisible}
        onCancel={() => {
          setEditClassModalVisible(false)
          setEditingClass(null)
        }}
        onOk={() => editClassForm.submit()}
      >
        <Form form={editClassForm} layout="vertical" onFinish={handleEditClass}>
          <Form.Item name="name" label="班级名称" rules={[{ required: true, message: '请输入班级名称' }]}>
            <Input placeholder="例如：初一一班" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 一键生成学生弹窗 */}
        <Modal
          title="一键生成学生账号"
          open={studentModalVisible}
          onCancel={() => !isGenerating && setStudentModalVisible(false)}
          onOk={() => studentForm.submit()}
          confirmLoading={isGenerating}
          width={600}
        >
          <Form form={studentForm} layout="vertical" onFinish={handleBatchCreateStudents} initialValues={{ count: 10 }}>
            <Form.Item name="classId" label="选择班级" rules={[{ required: true, message: '请选择班级' }]}>
              <Select placeholder="请选择归属班级">
                {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="count" label="生成数量" rules={[{ required: true, message: '请输入需要生成的账号数量' }]}>
              <Input type="number" min={1} max={100} placeholder="例如：40" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 生成结果弹窗 */}
        <Modal
          title="账号生成成功 (请妥善保存)"
          open={resultModalVisible}
          onCancel={() => setResultModalVisible(false)}
          footer={[
            <Button key="copy" type="primary" onClick={() => {
              const text = generatedAccounts.map(a => `账号: ${a.username}  密码: ${a.password}`).join('\n')
              navigator.clipboard.writeText(text)
              message.success('已复制到剪贴板')
            }}>复制全部账号</Button>,
            <Button key="close" onClick={() => setResultModalVisible(false)}>关闭</Button>
          ]}
          width={600}
        >
          <div className="bg-amber-50 text-amber-600 p-3 rounded-lg mb-4 text-sm border border-amber-100">
            注意：密码由系统随机生成且已加密存储，这是您查看明文密码的唯一机会，请务必复制保存并分发给学生。
          </div>
          <Table 
            dataSource={generatedAccounts} 
            rowKey="username"
            pagination={{ pageSize: 10 }}
            size="small"
            columns={[
              { title: '用户名', dataIndex: 'username', key: 'username' },
              { title: '初始密码', dataIndex: 'password', key: 'password' },
            ]}
          />
        </Modal>

        {/* 编辑学生弹窗 */}
        <Modal
          title="编辑学生信息"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false)
            setEditingStudent(null)
          }}
          onOk={() => editForm.submit()}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEditStudent}>
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="学生登录账号" />
            </Form.Item>
            <Form.Item name="classId" label="归属班级" rules={[{ required: true, message: '请选择归属班级' }]}>
              <Select placeholder="请选择班级">
                {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="password" label="重置密码" extra="如果不需要修改密码请留空，修改后学生登录无需再次强制修改。">
              <Input.Password placeholder="输入新密码 (留空则不修改)" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  )
}
