# 山科智行 Campus Pulse

这是一个基于高德地图开放平台 JSAPI 的校园出行工作台。项目保留了完整的路线规划能力，并重新设计了白色界面、地图主视图、页面结构和报告材料，避免和旧版导览页面雷同。

## 核心能力

- 选择起点和终点，实时生成步行路线
- 展示总距离、预计耗时和逐段行动提示
- 使用高德 JSAPI 2.0 加载实景地图、POI 检索、定位和步行规划
- 通过“实景地图”和“校园拓扑”两种视图核对路线
- 支持地点搜索、任务分类筛选、场景带筛选和地点详情页
- 后端不可用时自动回退到浏览器本地路网规划
- 可构建为静态前端，也可运行 Express 后端服务

## 技术结构

```text
src/                 React + Vite + TypeScript 前端
server/src/          Express + TypeScript 后端
shared/              前后端共享导航类型
public/maps/         校园拓扑底图
scripts/             报告与交付材料生成脚本
```

高德地图接入位置：

- `src/components/AmapLiveMap.tsx`：实景地图、定位、步行路线和语音导航
- `src/components/AmapPoiExplorer.tsx`：高德 POI 检索和实时地点补齐

核心接口：

- `GET /api/health`
- `GET /api/navigation/bootstrap`
- `POST /api/navigation/route`

路线规划请求示例：

```json
{
  "startPlaceId": "west-gate",
  "endPlaceId": "library-information-center"
}
```

## 本地运行

```bash
npm install
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:5173/#/`
- 后端：`http://127.0.0.1:8787`

高德实景地图为默认主视图。请在 `.env.local` 中配置：

```bash
VITE_AMAP_JSAPI_KEY=你的高德 Web 端 Key
VITE_AMAP_SECURITY_JS_CODE=你的高德安全密钥
```

未配置地图密钥时，系统仍可通过校园拓扑视图完成基础路线规划。

## 生产构建

```bash
npm run build
npm start
```

本地预览生产版本：

```bash
npm run preview
```

## GitHub Pages 部署

当前项目按 GitHub Pages 静态站点部署，页面地址为：

```text
https://2830500285.github.io/campus-pulse-amap/#/
```

推送到 `main` 后，`.github/workflows/pages.yml` 会自动构建并发布 `dist/`。高德地图配置通过仓库 Secrets 提供：

```text
VITE_AMAP_JSAPI_KEY
VITE_AMAP_SECURITY_JS_CODE
```

## Android App

`android/` 目录提供 Android WebView 客户端，属于 BS 结构中的移动端壳应用。App 默认加载 GitHub Pages 地址，业务逻辑仍由 Web 页面提供。推送到 `main` 后，`.github/workflows/android.yml` 会在 GitHub Actions 中构建 debug APK，并在工作流 artifact 中输出 `campus-pulse-debug-apk`。

## 校验命令

```bash
npm run lint
npm run test
npm run build
```

## 数据维护

前端展示数据：

- `src/data/campus.ts`
- `src/data/categories.ts`
- `src/data/places.ts`
- `src/data/graph.ts`

后端导航数据：

- `server/src/data/navigation-seed.ts`

共享类型：

- `shared/navigation.ts`

新增地点时至少维护：

- `id`
- `name`
- `categoryId`
- `zone`
- `description`
- `aliases`
- `keywords`
- `mapPoint`
- `accessNodeIds`
- `arrivalTips`

新增路网时维护：

- `graphNodes`
- `graphEdges`

## 交付材料

执行下面命令可生成报告、设计文档、发布说明、图表、截图占位图、源码压缩包和提交清单：

```bash
python3 scripts/generate_experiment_submission.py
```

最终材料输出到：

```text
output/doc/
```

## 当前边界

当前版本适合作为课程实验和项目演示使用，暂未包含室内导航、实时定位映射、后台维护、临时封路管理和多校区切换。这些能力可以在现有数据模型和路线规划服务上继续扩展。
