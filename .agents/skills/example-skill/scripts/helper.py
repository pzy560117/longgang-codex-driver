#!/usr/bin/env python3
"""
示例辅助脚本
用于演示如何在skill中包含可执行脚本
"""

def helper_function(data):
    """
    一个辅助函数示例
    
    Args:
        data: 输入数据
        
    Returns:
        处理后的数据
    """
    print(f"Processing: {data}")
    return data.upper()


if __name__ == "__main__":
    # 示例用法
    result = helper_function("hello skill")
    print(f"Result: {result}")
