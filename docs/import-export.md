# 导入与导出格式

Todo-list 可以导入两类 JSON：应用自身导出的带版本备份，以及没有 UUID 的外部数据。
备份采用扁平结构并保留 UUID；外部数据在导入时生成新 UUID，并作为新记录追加。

## 在页面中使用

打开“数据管理”，展开“导入 / 导出”。

- “导出全部”会导出 `works`、`publications`、`episodes` 和 `completion`。
- “导出（不含完成信息）”只导出三层作品数据，不包含观看或阅读状态。
- 每个作品操作区的“导出”只导出该作品及其出版物、集和完成信息，文件可以直接作为
  Todo-list 整体备份重新导入。
- 导入时可以选择整体数据，也可以只选择作品层、出版物层、集层或完成信息。
- Todo-list 备份按 UUID 合并；同 UUID、同层级的数据会覆盖现有记录。
- 外部 JSON 不需要 `id`，导入时会生成 UUID 并追加，不会覆盖已有实体。
- 两种导入都不会删除文件中未包含的现有记录。

建议在大量导入或手工修改 JSON 前先导出一份包含完成信息的完整备份。

## Todo-list 备份文件

应用导出的文件使用以下结构：

```json
{
  "format": "todo-list-catalog",
  "version": 1,
  "exportedAt": "2026-08-22T08:00:00.000Z",
  "data": {
    "works": [
      {
        "id": "a59ccf3e-2f87-4cf5-9b3d-0e5c5ea97662",
        "title": "示例作品",
        "coverUrl": "https://example.com/cover.jpg",
        "aliases": ["Example"],
        "authors": ["示例作者"],
        "otherInfo": "备注"
      }
    ],
    "publications": [
      {
        "id": "e63da685-ad3e-41d1-b697-02a803ac5518",
        "workId": "a59ccf3e-2f87-4cf5-9b3d-0e5c5ea97662",
        "category": "动画",
        "timelineGroup": "本篇",
        "title": "第一季",
        "subtitle": "",
        "date": "2026-01-10",
        "endDate": "2026-03-28",
        "isbn": ""
      }
    ],
    "episodes": [
      {
        "id": "75acc5b3-6440-4098-b81d-ab0ad18b22ae",
        "publicationId": "e63da685-ad3e-41d1-b697-02a803ac5518",
        "number": "01",
        "title": "第一集",
        "date": "2026-01-10"
      }
    ],
    "completion": [
      {
        "id": "75acc5b3-6440-4098-b81d-ab0ad18b22ae",
        "completed": true
      }
    ]
  }
}
```

顶层字段：

| 字段         | 类型   | 说明                                    |
| ------------ | ------ | --------------------------------------- |
| `format`     | 字符串 | 固定为 `todo-list-catalog`              |
| `version`    | 数字   | 当前固定为 `1`                          |
| `exportedAt` | 字符串 | 导出时间，ISO 8601 格式；导入时仅作说明 |
| `data`       | 对象   | IndexedDB 各 ObjectStore 的数据         |

整体导入要求 `works`、`publications` 和 `episodes` 都是数组。`completion` 可以省略。
应用自己导出的“不含完成信息”文件可以直接整体导入。

## 单作品导出文件

作品操作区的“导出”使用 `todo-list-catalog-work` 格式。出版物嵌套在作品中，集继续嵌套在
所属出版物中，因此一份文件本身就是完整的作品数据：

```json
{
  "format": "todo-list-catalog-work",
  "version": 1,
  "exportedAt": "2026-08-27T08:00:00.000Z",
  "data": {
    "work": {
      "id": "a59ccf3e-2f87-4cf5-9b3d-0e5c5ea97662",
      "title": "示例作品",
      "aliases": [],
      "authors": [],
      "otherInfo": "",
      "publications": [
        {
          "id": "e63da685-ad3e-41d1-b697-02a803ac5518",
          "workId": "a59ccf3e-2f87-4cf5-9b3d-0e5c5ea97662",
          "category": "动画",
          "title": "第一季",
          "subtitle": "",
          "date": "2026-01-10",
          "isbn": "",
          "episodes": [
            {
              "id": "75acc5b3-6440-4098-b81d-ab0ad18b22ae",
              "publicationId": "e63da685-ad3e-41d1-b697-02a803ac5518",
              "number": "01",
              "title": "第一集",
              "date": "2026-01-10"
            }
          ]
        }
      ]
    },
    "completion": [
      {
        "id": "75acc5b3-6440-4098-b81d-ab0ad18b22ae",
        "completed": true
      }
    ]
  }
}
```

导入器会把嵌套结构重新展开到 `works`、`publications` 和 `episodes` ObjectStore：

- 选择“整体数据”或“作品”时，导入作品及其全部出版物、集和完成信息。
- 选择“出版物”时，导入出版物、其下的集以及相关完成信息。
- 选择“集”时，只导入集及集的完成信息。
- 选择“完成信息”时，只导入完成映射。

## 备份中的各层字段

### `works`：作品层

| 字段        | 类型       | 必填 | 说明                     |
| ----------- | ---------- | ---- | ------------------------ |
| `id`        | 字符串     | 是   | 作品 UUID                |
| `title`     | 字符串     | 是   | 作品名                   |
| `coverUrl`  | 字符串     | 否   | 封面地址                 |
| `aliases`   | 字符串数组 | 是   | 别名，可以为空数组       |
| `authors`   | 字符串数组 | 是   | 作者，可以为空数组       |
| `otherInfo` | 字符串     | 是   | 其他信息，可以为空字符串 |

### `publications`：出版物层

| 字段            | 类型   | 必填 | 说明                               |
| --------------- | ------ | ---- | ---------------------------------- |
| `id`            | 字符串 | 是   | 出版物 UUID                        |
| `workId`        | 字符串 | 是   | 所属作品的 `id`                    |
| `category`      | 字符串 | 是   | 类别，例如小说、动画、电影         |
| `timelineGroup` | 字符串 | 否   | 同类别下的系列轨道，例如本篇、外传 |
| `title`         | 字符串 | 是   | 书名或剧名                         |
| `subtitle`      | 字符串 | 是   | 子名称，可以为空字符串             |
| `date`          | 字符串 | 是   | 开始日期                           |
| `endDate`       | 字符串 | 否   | 结束日期                           |
| `isbn`          | 字符串 | 是   | ISBN，可以为空字符串               |

### `episodes`：集层

| 字段            | 类型   | 必填 | 说明                        |
| --------------- | ------ | ---- | --------------------------- |
| `id`            | 字符串 | 是   | 集 UUID                     |
| `publicationId` | 字符串 | 是   | 所属出版物的 `id`           |
| `number`        | 字符串 | 是   | 集数或卷次，例如 `01`、`EX` |
| `title`         | 字符串 | 是   | 名称                        |
| `date`          | 字符串 | 是   | 日期                        |

日期通常使用 `YYYY-MM-DD`。未知日期可以使用空字符串；无法解析到年月的数据会保存在
IndexedDB 中，但不会出现在时间轴上。

### `completion`：完成映射

| 字段        | 类型   | 必填 | 说明                                |
| ----------- | ------ | ---- | ----------------------------------- |
| `id`        | 字符串 | 是   | 对应作品、出版物或集的 UUID         |
| `completed` | 布尔值 | 是   | `true` 表示完成，`false` 表示未完成 |

导入的实体没有对应完成映射时，新 UUID 会自动写入 `completed: false`。如果导入文件没有
`completion`，已有 UUID 的完成状态保持不变。

## 外部整体数据（无 UUID）

选择“整体数据”导入不带 `format`、`version` 的 JSON 时，文件会被视为外部数据。
外部整体数据使用嵌套结构，因此不需要 `id`、`workId` 或 `publicationId`：

```json
[
  {
    "title": "外部作品",
    "coverUrl": "https://example.com/cover.jpg",
    "aliases": ["Example"],
    "authors": ["示例作者"],
    "otherInfo": "备注",
    "publications": [
      {
        "category": "动画",
        "timelineGroup": "本篇",
        "title": "第一季",
        "subtitle": "",
        "date": "2026-01-10",
        "endDate": "2026-03-28",
        "isbn": "",
        "episodes": [
          {
            "number": "01",
            "title": "第一集",
            "date": "2026-01-10"
          }
        ]
      }
    ]
  }
]
```

也可以把数组放在 `{ "works": [...] }` 中。导入过程会依次为作品、出版物和集生成 UUID，
并自动填写子级的 `workId`、`publicationId`。外部数据即使带有 `id`，实体 ID 也会重新生成；
需要原样恢复 UUID 和完成状态时，应使用带 `format`、`version` 的 Todo-list 备份格式。

外部字段允许适当省略：

- 作品只要求 `title`；`aliases`、`authors` 默认为空数组，`otherInfo` 默认为空字符串。
- 出版物要求 `category` 和 `title`；`subtitle`、`date`、`isbn` 默认为空字符串。
- 集要求 `number` 和 `title`；`date` 默认为空字符串。
- `coverUrl`、`timelineGroup` 和 `endDate` 都可以省略。

## 单层导入

选择某个层级后，可以使用完整 Todo-list 备份，也可以直接导入没有 UUID 的外部数组。
导入外部出版物时，需要在面板中选择所属作品；导入外部集时，需要选择所属出版物。
例如选择一个出版物后导入集：

```json
[
  {
    "number": "01",
    "title": "第一集",
    "date": "2026-01-10"
  }
]
```

应用会为这条集数据生成 UUID，并使用面板中选择的出版物 UUID。使用完整备份文件做单层
导入时，应用只读取所选字段，保留备份中的 UUID，并忽略其他数组。

完成信息不能脱离 UUID 使用，因此单独导入 `completion` 时仍要求每项包含 `id` 和
`completed`。

## 批量导入

文件选择框支持一次选择多个 JSON 文件。按住系统的 Shift 或 Command/Ctrl 键即可多选。

- 同一批文件共用当前选择的导入范围。
- 单层导入出版物或集时，同一批文件也共用所选父级。
- 所有文件会先完成 JSON 解析、字段校验和跨文件 UUID 冲突检查，然后通过一次 IndexedDB
  事务写入；任一文件失败时整批都不会写入。
- 错误提示会包含出错的文件名。
- 多个文件在同一层包含相同 UUID 时，文件选择顺序靠后的记录覆盖前面的记录。
- 外部无 UUID 数据仍会为每条实体生成新 UUID，因此会作为新记录追加。

## UUID 与关联规则

- Todo-list 备份的同一数组内不能出现重复 `id`。
- Todo-list 备份中的 `works`、`publications` 和 `episodes` 不能共用同一个 `id`。
- 外部实体数据不使用输入 ID，生成的 UUID 会避开当前数据库中的所有实体 UUID。
- 备份的单层子级如果找不到父级仍会写入 IndexedDB，但在对应父级存在前不会显示。
- 手工修改备份 UUID 时，必须同时修改子级的 `workId` 或 `publicationId` 以及完成映射。
- 导入只合并数据，不执行删除。删除数据请使用管理面板中的删除按钮。

文件应保存为 UTF-8 编码的合法 JSON。字段类型错误、格式版本不支持或 UUID 冲突时，
应用会拒绝整个导入，IndexedDB 不会写入部分结果。
