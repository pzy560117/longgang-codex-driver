---
name: knowledge-base
description: 知识库 + RAG 开发指南
---

# 知识库 + RAG 开发指南

## 项目结构

```
WHartTest_Django/knowledge/
├── models.py           # KnowledgeBase, Document 模型
├── services.py         # 向量检索服务
├── serializers.py      # API 序列化
└── views.py            # 知识库 API
```

## 核心组件

### Qdrant 向量数据库
- 容器: `wharttest-qdrant`
- 端口: 8918 (REST API)
- 数据卷: `qdrant-data`

### BGE-M3 嵌入模型
- 容器: `wharttest-bge-m3` (Ollama)
- 端口: 8917
- 模型: `bge-m3`

## 知识库服务

```python
from langchain_qdrant import QdrantVectorStore
from langchain_community.embeddings import OllamaEmbeddings

# 初始化嵌入模型
embeddings = OllamaEmbeddings(
    model="bge-m3",
    base_url="http://bge-m3:11434"
)

# 连接向量数据库
vector_store = QdrantVectorStore.from_existing_collection(
    embedding=embeddings,
    collection_name="my_collection",
    url="http://qdrant:6333"
)

# 相似度检索
docs = vector_store.similarity_search(query, k=5)
```

## 文档处理

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = splitter.split_documents(documents)
```

## RAG 检索增强

```python
from langchain.chains import RetrievalQA

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vector_store.as_retriever(
        search_kwargs={"k": 5}
    ),
    return_source_documents=True
)

result = qa_chain.invoke({"query": question})
```

## 环境变量

```bash
QDRANT_URL=http://qdrant:6333
OLLAMA_BASE_URL=http://bge-m3:11434
```

