# 打她！线上对战 🎮

60秒全球匹配打她对战游戏！

---

## 🚀 部署上线（完整步骤，不需要会编程）

### 第一步：注册 GitHub 账号
1. 打开 https://github.com
2. 点右上角 **Sign up** 注册账号
3. 记住你的用户名

---

### 第二步：创建代码仓库
1. 登录 GitHub 后，点右上角 **+** → **New repository**
2. Repository name 填：`da-ta-game`（或任意名字）
3. 选 **Public**
4. 点 **Create repository**

---

### 第三步：上传代码
1. 在新建的仓库页面，点 **uploading an existing file**（或 **Add file → Upload files**）
2. 把这个项目的所有文件夹和文件拖进去（整个 whack-game 文件夹的内容）
3. 点 **Commit changes**

---

### 第四步：部署到 Railway
1. 打开 https://railway.app
2. 点 **Start a New Project**
3. 选 **Deploy from GitHub repo**
4. 用 GitHub 账号授权登录
5. 选择你刚才创建的 `da-ta-game` 仓库
6. Railway 会自动检测并部署（等待约 1-2 分钟）
7. 部署完成后点 **Settings → Networking → Generate Domain**
8. 你会得到一个类似 `da-ta-game.up.railway.app` 的网址

---

### 第五步：开始游戏！
- 把这个网址发给任何人
- 两个人各自打开网址
- 输入昵称，点"开始匹配"
- 自动匹配，60秒对战！

---

## 💰 费用
- Railway 免费套餐：每月 $5 额度（小流量完全够用）
- 如果流量大了，付费套餐 $20/月

---

## 🛠 本地运行测试
```bash
npm install
npm start
```
打开 http://localhost:3000 即可测试
