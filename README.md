# 电商模板DIY设计系统

## 快速启动

### Linux/Mac
```bash
bash start.sh
```

### Windows
```cmd
start.bat
```

### 手动启动

**后端：**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

## 访问地址

- 前端: http://localhost:5173
- 后端: http://localhost:8000
- API文档: http://localhost:8000/docs

## 默认管理员

- 邮箱: admin@example.com
- 密码: admin123

## 技术栈

- **前端**: React 18 + Vite + TypeScript + Tailwind CSS + react-konva
- **后端**: Python 3.11+ + FastAPI + SQLAlchemy 2.0
- **数据库**: SQLite（开发）/ MySQL（生产）
- **AI**: rembg (U²-Net) 本地抠图

## 功能清单

### 管理员端
- ✅ 分类管理（CRUD）
- ✅ 素材管理（图片/字体上传、删除）
- ✅ 公共字体库
- ✅ 模板管理（创建、编辑、复制、删除）
- ✅ 模板编辑器（画布、图层、拖拽、缩放、旋转）
- ✅ 三种图层类型（背景、可替换图片、文字）
- ✅ 多边形套索工具（背景透明化）
- ✅ 撤销/重做
- ✅ 草稿保存/版本发布/下架
- ✅ 版本历史预览与复制

### 用户端
- ✅ 注册/登录
- ✅ 模板广场（搜索、筛选、分页）
- ✅ DIY编辑器（图片替换、文字编辑）
- ✅ AI智能抠图
- ✅ 保存/导出（PNG/JPEG）
- ✅ 我的设计管理
- ✅ 个人素材库
