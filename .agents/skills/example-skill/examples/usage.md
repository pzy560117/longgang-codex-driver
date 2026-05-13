# Example Skill - 使用示例

## 示例 1: 简单任务处理

假设你需要处理一个文本文件：

```python
# 读取文件
with open('data.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# 使用helper函数处理
from scripts.helper import helper_function
result = helper_function(content)

# 输出结果
print(result)
```

## 示例 2: 批量处理

处理多个文件：

```python
import os
from scripts.helper import helper_function

files = ['file1.txt', 'file2.txt', 'file3.txt']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        processed = helper_function(content)
        
    # 保存处理结果
    output_file = f'output_{file}'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(processed)
```

## 示例 3: 配置化处理

使用配置文件：

```yaml
# config.yaml
mode: strict
output_format: json
options:
  uppercase: true
  trim_whitespace: true
```

```python
import yaml

# 加载配置
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

# 根据配置处理
if config['options']['uppercase']:
    result = helper_function(data)
```

## 运行示例

要运行这些示例：

```bash
# 运行简单示例
python scripts/helper.py

# 或者直接导入使用
python -c "from scripts.helper import helper_function; print(helper_function('test'))"
```
