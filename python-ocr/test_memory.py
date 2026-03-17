"""
测试阿里云百炼记忆库功能

运行前请确保：
1. 已配置环境变量 DASHSCOPE_API_KEY
2. 已配置环境变量 BAILIAN_MEMORY_LIBRARY_ID
3. 已在百炼平台创建记忆库并配置规则

使用方法：
    cd python-ocr
    python test_memory.py
"""
import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rag.services.bailian_memory import BailianMemory


def test_memory_service():
    """测试记忆库服务"""
    print("=" * 60)
    print("阿里云百炼记忆库功能测试")
    print("=" * 60)
    
    # 检查环境变量
    api_key = os.getenv("DASHSCOPE_API_KEY")
    library_id = os.getenv("BAILIAN_MEMORY_LIBRARY_ID")
    
    print(f"\n1. 环境变量检查:")
    print(f"   DASHSCOPE_API_KEY: {'已配置' if api_key else '未配置'}")
    print(f"   BAILIAN_MEMORY_LIBRARY_ID: {'已配置' if library_id else '未配置'}")
    
    if not api_key or not library_id:
        print("\n❌ 环境变量未完全配置，请在 .env 文件中设置")
        return
    
    # 初始化服务
    print(f"\n2. 初始化记忆库服务...")
    try:
        memory = BailianMemory()
        print("   ✅ 记忆库服务初始化成功")
    except Exception as e:
        print(f"   ❌ 初始化失败: {e}")
        return
    
    # 测试学生ID
    test_student_id = "test_student_001"
    
    # 测试1: 添加记忆
    print(f"\n3. 测试添加记忆...")
    messages = [
        {"role": "user", "content": "这道二元一次方程我不会解"},
        {"role": "assistant", "content": "我们先看看方程的形式，你能否告诉我第一步应该怎么做？"},
        {"role": "user", "content": "是不是要先移项？"},
        {"role": "assistant", "content": "对的！移项是第一步，你理解得很对。"}
    ]
    
    result = memory.add_memory(
        messages=messages,
        memory_content="学生在二元一次方程求解中，能够理解移项的概念，需要继续巩固合并同类项的步骤",
        user_id=test_student_id
    )
    
    if result.get("error"):
        print(f"   ❌ 添加记忆失败: {result.get('message')}")
    else:
        print("   ✅ 记忆添加成功")
        print(f"   返回数据: {result}")
    
    # 测试2: 查询记忆
    print(f"\n4. 测试查询记忆...")
    query_result = memory.query_memory(
        query="二元一次方程",
        user_id=test_student_id,
        top_k=3
    )
    
    if query_result.get("error"):
        print(f"   ❌ 查询记忆失败: {query_result.get('message')}")
    else:
        print("   ✅ 记忆查询成功")
        memories = query_result.get("memories", [])
        print(f"   检索到 {len(memories)} 条记忆")
        for i, mem in enumerate(memories, 1):
            print(f"   [{i}] {mem.get('content', '')[:100]}...")
    
    # 测试3: 添加辅导会话记忆
    print(f"\n5. 测试添加辅导会话记忆...")
    session_result = memory.add_learning_memory(
        student_id=test_student_id,
        problem="2x + 3 = 7，求解x",
        error_type="移项时符号错误",
        hint_provided="提醒学生移项要变号，正数变负数",
        student_response="理解了，以后注意符号变化",
        session_messages=messages
    )
    
    if session_result.get("error"):
        print(f"   ❌ 添加会话记忆失败: {session_result.get('message')}")
    else:
        print("   ✅ 辅导会话记忆添加成功")
    
    # 测试4: 获取学生上下文
    print(f"\n6. 测试获取学生上下文...")
    context = memory.get_student_context(
        student_id=test_student_id,
        current_problem="3x - 5 = 10"
    )
    
    if context:
        print("   ✅ 成功获取学生上下文")
        print(f"   上下文内容:\n{context[:200]}...")
    else:
        print("   ⚠️ 未获取到上下文（可能是记忆还未生效或没有相关记忆）")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    test_memory_service()
