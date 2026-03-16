"""
将JSON格式的错误模式数据转换为CSV格式（V3版本）
步骤和错误信息用JSON格式存储在单元格中
"""
import json
import csv
import os


def json_to_csv_v3(json_file_path: str, csv_file_path: str = None):
    """
    将JSON数据转换为CSV格式
    
    格式：
    - ID: 题目唯一标识
    - 题干: 题目内容
    - 选项: 选择题选项（可为空）
    - 正确解答步骤: JSON数组，每个元素包含步骤序号、描述、做法
    - 常见错误及原因: JSON数组，每个元素包含步骤序号、错误列表
    """
    if csv_file_path is None:
        csv_file_path = json_file_path.replace('.json', '_v3.csv')
    
    # 读取JSON
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, dict):
        data = [data]
    
    # 表头
    fieldnames = ["ID", "题干", "选项", "正确解答步骤", "常见错误及原因"]
    
    # 准备数据行
    rows = []
    
    for problem in data:
        # 构建正确解答步骤JSON
        steps = problem.get("steps", [])
        steps_json = []
        for step in steps:
            steps_json.append({
                "步骤序号": step.get("step_number", ""),
                "步骤描述": step.get("description", ""),
                "正确做法": step.get("correct_action", "")
            })
        
        # 构建常见错误及原因JSON
        errors_json = []
        for step in steps:
            step_errors = {
                "步骤序号": step.get("step_number", ""),
                "步骤描述": step.get("description", ""),
                "错误列表": []
            }
            
            for error in step.get("common_errors", []):
                step_errors["错误列表"].append({
                    "错误类型": error.get("error_type", ""),
                    "错误做法": error.get("wrong_action", ""),
                    "错误原因": error.get("why_wrong", ""),
                    "提示": error.get("hint", ""),
                    "发生频率": error.get("frequency", "medium")
                })
            
            errors_json.append(step_errors)
        
        row = {
            "ID": problem.get("problem_id", ""),
            "题干": problem.get("title", ""),
            "选项": "",  # 数学题一般没有选项
            "正确解答步骤": json.dumps(steps_json, ensure_ascii=False),
            "常见错误及原因": json.dumps(errors_json, ensure_ascii=False)
        }
        
        rows.append(row)
    
    # 写入CSV
    with open(csv_file_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✓ CSV文件已生成: {csv_file_path}")
    print(f"✓ 共 {len(rows)} 道题目")
    print(f"\n表头: {fieldnames}")
    print(f"\n示例数据（第1题）:")
    if rows:
        print(f"  ID: {rows[0]['ID']}")
        print(f"  题干: {rows[0]['题干']}")
        print(f"  正确解答步骤: {rows[0]['正确解答步骤'][:100]}...")
        print(f"  常见错误及原因: {rows[0]['常见错误及原因'][:100]}...")
    
    return csv_file_path


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="将JSON转换为CSV（V3版本）")
    parser.add_argument("--json", type=str, required=True, help="输入JSON文件路径")
    parser.add_argument("--csv", type=str, default=None, help="输出CSV文件路径")
    
    args = parser.parse_args()
    
    json_to_csv_v3(args.json, args.csv)
