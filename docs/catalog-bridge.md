# 本地目录数据桥协议

数据桥供本地工具或 AI 直接操作当前页面的 IndexedDB：

```text
本地工具 -> HTTP RPC -> dev server -> WebSocket -> 页面 Worker -> IndexedDB
```

## 启用

```sh
npm run dev:bridge
```

普通 `npm run dev` 不提供接口，页面也不显示开关。

在“数据管理”中开启“允许服务端操作数据”后，页面会：

1. 下载一份包含完成状态的完整 JSON。
2. 生成随机 `pageId` 并连接服务器。
3. 在顶部持续显示控制状态和 `pageId`。
4. 禁用页面新增、修改、删除、导入及完成状态切换；查看和导出仍可用。

关闭开关后恢复页面写入。同一标签页刷新时会使用 `sessionStorage` 中的原 `pageId`
重新连接。

## 发现页面

```http
GET /__catalog/pages
```

```json
{
  "pages": [
    {
      "pageId": "bb40ec69-0777-4bd4-b858-ab3c6bd77a8e",
      "connectedAt": "2026-09-02T08:00:00.000Z"
    }
  ]
}
```

## 调用 RPC

```http
POST /__catalog/pages/:pageId/rpc
Content-Type: application/json
```

请求中的 `id` 由调用方生成并用于关联响应，`params` 始终是对象：

```json
{
  "id": "request-1",
  "method": "catalog.snapshot",
  "params": {}
}
```

成功：

```json
{
  "type": "response",
  "id": "request-1",
  "ok": true,
  "result": {}
}
```

业务失败仍返回 HTTP 200：

```json
{
  "type": "response",
  "id": "request-1",
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "找不到目标数据"
  }
}
```

## 数据字段

- `works`：`id`、`title`、`coverUrl?`、`aliases[]`、`authors[]`、`otherInfo`。
- `publications`：`id`、`workId`、`category`、`timelineGroup?`、`title`、
  `subtitle`、`date`、`endDate?`、`isbn`。
- `episodes`：`id`、`publicationId`、`number`、`title`、`date`。
- `completion`：`id`、`completed`。

创建实体时可以省略 `id`，页面会生成 UUID v4 并在结果中返回。其他可省略字段默认使用
空字符串或空数组；新实体的完成状态默认为 `false`。

## 方法

### 读取完整快照

```json
{ "id": "1", "method": "catalog.snapshot", "params": {} }
```

结果包含 `works`、`publications`、`episodes` 和 `completion` 四个数组。

### 读取单个实体

```json
{
  "id": "2",
  "method": "catalog.entity.get",
  "params": { "storeName": "publications", "id": "UUID" }
}
```

`storeName` 只能是 `works`、`publications` 或 `episodes`。

### 创建

```json
{
  "id": "3",
  "method": "catalog.entity.create",
  "params": {
    "storeName": "publications",
    "data": {
      "workId": "作品 UUID",
      "category": "小说",
      "title": "作品 1",
      "date": "2026-09-01"
    }
  }
}
```

### 局部修改

```json
{
  "id": "4",
  "method": "catalog.entity.update",
  "params": {
    "storeName": "publications",
    "id": "出版物 UUID",
    "changes": { "date": "2026-09-12" }
  }
}
```

未提供字段保持不变，`id` 不允许修改。修改父级 UUID 时，新父级必须存在。

### 删除

```json
{
  "id": "5",
  "method": "catalog.entity.delete",
  "params": { "storeName": "publications", "id": "出版物 UUID" }
}
```

删除作品会级联删除出版物和集；删除出版物会级联删除集。对应完成状态同时删除。
没有出现于请求中的数据不会被当作删除。

### 设置完成状态

```json
{
  "id": "6",
  "method": "catalog.completion.set",
  "params": { "id": "任一实体 UUID", "completed": true }
}
```

### 原子批量操作

```json
{
  "id": "7",
  "method": "catalog.batch",
  "params": {
    "operations": [
      {
        "action": "create",
        "storeName": "publications",
        "data": {
          "id": "预先生成的 UUID v4",
          "workId": "作品 UUID",
          "category": "小说",
          "title": "作品 2"
        }
      },
      {
        "action": "setCompletion",
        "id": "预先生成的 UUID v4",
        "completed": false
      }
    ]
  }
}
```

操作按数组顺序执行，支持 `create`、`update`、`delete`、`setCompletion`。结果是与操作顺序
一致的数组；任一操作失败时不会写入数据库。批量创建父子数据时，应预先生成 UUID。

## 错误与重试

常见错误码：

- `INVALID_REQUEST`：请求字段或数据关系无效。
- `NOT_FOUND`：实体或父级不存在。
- `ALREADY_EXISTS`：创建时 UUID 已存在。
- `PAGE_NOT_CONNECTED`：页面没有连接。
- `PAGE_DISCONNECTED`：请求期间页面断开。
- `PAGE_TIMEOUT`：页面处理超时。
- `BODY_TOO_LARGE`：请求体超过 5 MiB。
- `INTERNAL_ERROR`：数据库或页面内部错误。

协议没有 revision。如果写请求超时或断线，应先重新调用 `catalog.snapshot` 或
`catalog.entity.get` 确认结果，再决定是否重试。

推荐工具流程：发现唯一页面、读取快照、按 UUID 操作、检查 `ok`、再次读取验证。
