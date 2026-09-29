# 足迹数据桥

运行 `npm run dev:bridge`，打开 `/travel`，在“数据管理”中开启“允许服务端操作数据”。
开启后直接连接并显示 `pageId`，禁用当前页的写操作；查看、筛选和导出不受影响。
不会自动下载备份，需要时可在“数据管理”中手动导出。
普通 `npm run dev` 和生产构建不提供数据桥。修改服务端代码后需要重新启动开发服务。

服务端仅转发请求，数据仍保存在当前浏览器的 `todo-list-travel` IndexedDB 中。
页面必须保持打开；刷新后沿用 sessionStorage 中的 `todo-list:travel-bridge-page-id` 重连。
离开页面断开，关闭开关清除会话。作品的 `/__catalog/*`、`catalog.*` 保持兼容，数据相互隔离。

## 连接与请求

```text
GET  /__travel/pages
POST /__travel/pages/:pageId/rpc
WS   /__travel/ws
```

页面发现返回 `{ "pages": [{ "pageId": "…", "connectedAt": "…" }] }`。多个页面在线时，
由调用方明确选择目标。HTTP、WebSocket 均限本机访问并检查 Host/Origin；不作为公网接口使用。

请求、响应格式沿用[作品数据桥](catalog-bridge.md)，每次 HTTP 调用使用新的请求 `id`：

```json
{ "id": "request-1", "method": "travel.snapshot", "params": {} }
```

成功返回 `{ "type": "response", "id": "request-1", "ok": true, "result": … }`。
业务失败返回 HTTP 200 和 `ok: false`，具体原因在 `error.code`、`error.message` 中。
参数格式、页面连接等传输错误使用 HTTP 4xx/5xx。请求体上限 5 MiB，超时为 30 秒。

## 读取

| 方法                      | params                                                     | 返回内容                                                |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `travel.snapshot`         | `{}`                                                       | `regions`、`footprints`，不含边界几何                   |
| `travel.regions.get`      | `{ "id": "110114" }`                                       | `region`、从国家到当前地区的 `path`、`isLeaf`           |
| `travel.regions.children` | `{ "parentId": "CN" }`                                     | `parent`、已保存的直接下级 `children`；父节点含导入状态 |
| `travel.footprints.get`   | `{ "id": "足迹 ID" }`                                      | 单条足迹                                                |
| `travel.footprints.list`  | 可选 `regionId`、`includeDescendants`、`year`、`visitType` | 筛选后的足迹数组                                        |
| `travel.boundaries.get`   | `{ "key": "边界 key" }`                                    | 含坐标系与几何的边界记录                                |
| `travel.export`           | 可选 `regionId`                                            | 完整备份，或包含祖先链的分支备份                        |

查询直接下级时，省略 `parentId` 或传 `null` 返回国家根节点，不自动导入地区。
足迹筛选默认不包含后代；需要时传 `includeDescendants: true`。
`year` 使用字符串年份，`"unknown"` 表示时间未知。

## 写入：预览后提交

所有写入共用两个入口，单条、批量均使用 `operations` 数组，不另设直接写入接口。

### 预览

```json
{
  "id": "request-2",
  "method": "travel.mutations.preview",
  "params": {
    "operations": [
      {
        "action": "footprint.create",
        "data": {
          "regionId": "110114",
          "name": "昌平徒步",
          "time": "2026-09-12",
          "visitType": "户外",
          "notes": "",
          "pos": null
        }
      }
    ]
  }
}
```

目标地区必须已存在。预览不写数据库，返回 `previewId`、`expiresAt`、`added`、`updated`、
`deleted`、`warnings` 和逐条 `changes`。每个差异包含 `store`、`id`、`before`、`after`；
父地区状态等连带变化也包含在内。计数按实际变更记录计算，不是操作条数。
边界差异只显示 key、坐标系和几何类型，不重复传输全部坐标。

### 提交

检查预览并确认后，提交同一个 `previewId`：

```json
{
  "id": "request-3",
  "method": "travel.mutations.commit",
  "params": { "previewId": "预览返回的 ID" }
}
```

提交时在同一读写事务内比对预览基线、执行现有业务校验并写入变化的记录；全部成功才提交。
数据变化返回 `CONFLICT`，需要重新预览。成功返回 `committed: true` 和变更摘要，并刷新页面。
当前页的禁写开关不是跨标签页锁，其他标签页的修改仍由基线检查处理。

计划保存在页面内存中，最多保留最近 10 个、有效期 10 分钟。刷新、离开页面或关闭控制后失效。
同一有效计划重复提交复用第一次结果，不重复写入；请求 `id` 本身不提供幂等保证。
超时、断线不代表写入失败，尤其页面刷新后，应先回读数据再决定是否重新预览。

## 操作格式

| action                  | 字段                 | 说明                                                              |
| ----------------------- | -------------------- | ----------------------------------------------------------------- |
| `region.create`         | `data`               | 必填 `id`、`name`、`kind`；非国家地区还需 `parentId`              |
| `region.update`         | `id`、`changes`      | 局部修改地区                                                      |
| `region.delete`         | `id`                 | 仅删除没有下级、没有足迹引用的地区                                |
| `region.importChildren` | `parentId`、`source` | 合并已有格式的直接下级清单                                        |
| `footprint.create`      | `data`               | 必填 `regionId`、`name`、`visitType`；缺少 `id` 时预览生成 UUID   |
| `footprint.update`      | `id`、`changes`      | 局部修改足迹                                                      |
| `footprint.delete`      | `id`                 | 只删除足迹，不裁剪树或清理边界                                    |
| `boundary.put`          | `data`               | 保存 `{ key, coordinateSystem, geometry }`；同 key 不同内容报冲突 |
| `backup.import`         | `source`             | 合并页面导出的 `todo-list-footprints` version 1 备份              |

操作按数组顺序执行；批量创建父子地区时先创建父级。地区使用标准编码，父级显式指定。
普通地区编辑不能修改 `id`、`parentId`、`state`、`importedAt`，导入状态由数据层管理。

地区可省略字段默认：`parentId: null`、`aliases: []`、`classification: "administrative"`、
`sortOrder: 0`、`notes: ""`、`pos: null`、`boundaryKey: null`。新地区初始为 `unloaded`。
足迹可省略字段默认：`time: null`、`notes: ""`、`pos: null`，不自动复制地区坐标。
`time` 支持 `YYYY`、`YYYY-MM`、`YYYY-MM-DD`、`YYYY-MM-DDTHH:mm` 或 `null`；
分钟精度也接受空格分隔的 `YYYY-MM-DD HH:mm`，保存时规范成 `T` 分隔。它表示当地时间，
不自动推断时区或转换成 UTC；原有年／月／日记录保持原精度。
`visitType` 为旅游、户外、居住、工作、办事、探亲、求学、中转中的一个。

修改中未提供的字段保持不变。`pos` 只能整体替换或设为 `null`，例如：

```json
{ "coordinates": [116.23, 40.22], "coordinateSystem": "GCJ02" }
```

坐标系支持 `WGS84`、`GCJ02`、`BD09LL`，坐标顺序为经度、纬度。边界支持 Polygon/MultiPolygon。
新建足迹或更换地区可选择任意已保存的地区，包括国家和有下级的父节点；目标地区必须存在。
备份恢复允许这些历史记录，清单未包含的数据不会被删除。

直接下级清单示例：

```json
{
  "format": "todo-list-region-children",
  "version": 1,
  "parentId": "110000",
  "coverage": "partial",
  "children": [{ "id": "110114", "name": "昌平区", "kind": "区", "pos": null }]
}
```

`coverage` 为 `partial` 或 `complete`，`children` 只包含直接下级；可附带 `boundaries` 数组。
边界建议按 key 单独传输。单个请求超过上限时明确报错；大备份继续使用页面文件导入。
