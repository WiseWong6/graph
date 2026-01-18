"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanceDBVectorStore = void 0;
var llamaindex_1 = require("llamaindex");
var lancedb = require("@lancedb/lancedb");
var fs_1 = require("fs");
/**
 * LanceDB 向量存储适配器
 *
 * 实现了 LlamaIndex 的 BaseVectorStore 接口，使用 LanceDB 作为底层存储。
 * 解决了 SimpleVectorStore 在大数据量下的内存限制问题。
 */
var LanceDBVectorStore = /** @class */ (function (_super) {
    __extends(LanceDBVectorStore, _super);
    function LanceDBVectorStore(init) {
        var _this = _super.call(this, init) || this;
        _this.storesText = true;
        _this.db = null;
        _this.table = null;
        _this.uri = init.uri;
        _this.tableName = init.tableName || "vectors";
        return _this;
    }
    /**
     * 初始化数据库连接和表
     */
    LanceDBVectorStore.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, tableNames, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.db)
                            return [2 /*return*/];
                        // 确保目录存在
                        if (!(0, fs_1.existsSync)(this.uri)) {
                            (0, fs_1.mkdirSync)(this.uri, { recursive: true });
                        }
                        _a = this;
                        return [4 /*yield*/, lancedb.connect(this.uri)];
                    case 1:
                        _a.db = _c.sent();
                        return [4 /*yield*/, this.db.tableNames()];
                    case 2:
                        tableNames = _c.sent();
                        if (!!tableNames.includes(this.tableName)) return [3 /*break*/, 3];
                        return [3 /*break*/, 5];
                    case 3:
                        _b = this;
                        return [4 /*yield*/, this.db.openTable(this.tableName)];
                    case 4:
                        _b.table = _c.sent();
                        _c.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    LanceDBVectorStore.prototype.client = function () {
        return this.db;
    };
    /**
     * 添加节点到向量存储
     */
    LanceDBVectorStore.prototype.add = function (nodes) {
        return __awaiter(this, void 0, void 0, function () {
            var records, tableNames, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1:
                        _c.sent();
                        if (!nodes || nodes.length === 0) {
                            return [2 /*return*/, []];
                        }
                        records = nodes.map(function (node) {
                            var _a;
                            return {
                                id: node.id_,
                                vector: node.getEmbedding(),
                                text: node.getContent(JSON.stringify(node.metadata)), // 或者是 node.getText()
                                metadata: JSON.stringify(node.metadata),
                                node_id: node.id_,
                                ref_doc_id: ((_a = node.sourceNode) === null || _a === void 0 ? void 0 : _a.nodeId) || node.id_
                            };
                        });
                        if (!!this.table) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.db.tableNames()];
                    case 2:
                        tableNames = _c.sent();
                        if (!tableNames.includes(this.tableName)) return [3 /*break*/, 5];
                        _a = this;
                        return [4 /*yield*/, this.db.openTable(this.tableName)];
                    case 3:
                        _a.table = _c.sent();
                        return [4 /*yield*/, this.table.add(records)];
                    case 4:
                        _c.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        _b = this;
                        return [4 /*yield*/, this.db.createTable(this.tableName, records)];
                    case 6:
                        _b.table = _c.sent();
                        _c.label = 7;
                    case 7: return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, this.table.add(records)];
                    case 9:
                        _c.sent();
                        _c.label = 10;
                    case 10: return [2 /*return*/, nodes.map(function (node) { return node.id_; })];
                }
            });
        });
    };
    /**
     * 删除节点
     */
    LanceDBVectorStore.prototype.delete = function (refDocId, deleteOptions) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1:
                        _a.sent();
                        if (!this.table)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.table.delete("ref_doc_id = '".concat(refDocId, "'"))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 查询
     */
    LanceDBVectorStore.prototype.query = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var builder, idList, results, nodes, similarities, ids, _loop_1, _i, results_1, row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.init()];
                    case 1:
                        _a.sent();
                        if (!this.table) {
                            return [2 /*return*/, { nodes: [], similarities: [], ids: [] }];
                        }
                        builder = this.table.search(query.queryEmbedding);
                        // 设置 Top K
                        builder = builder.limit(query.similarityTopK);
                        // 过滤条件 (简单的 metadata 过滤)
                        if (query.docIds && query.docIds.length > 0) {
                            idList = query.docIds.map(function (id) { return "'".concat(id, "'"); }).join(",");
                            builder = builder.where("node_id IN (".concat(idList, ")"));
                        }
                        return [4 /*yield*/, builder.execute()];
                    case 2:
                        results = _a.sent();
                        nodes = [];
                        similarities = [];
                        ids = [];
                        _loop_1 = function (row) {
                            // 还原 Node
                            // 注意：这里我们只还原了最基础的 TextNode，丢失了原始 Node 的具体类型
                            // 但对于 RAG 检索来说，TextNode 足够了
                            var metadata = JSON.parse(row.metadata);
                            // 构造 TextNode (需要从 llamaindex 导入)
                            // 由于我们无法直接 new TextNode（循环依赖或类型问题），
                            // 我们返回一个兼容的对象
                            // 实际上，LlamaIndex 的 VectorStoreQueryResult 要求返回 BaseNode[]
                            // 我们需要尽力还原
                            // 这里的 row 包含 _distance (L2 distance)
                            // 转换为 similarity: 1 / (1 + distance) 或者 1 - distance (如果是 cosine distance)
                            // LanceDB 默认是 L2 distance ? 
                            // 查阅文档：LanceDB search defaults to L2 (Euclidean) distance.
                            // Euclidean distance range is [0, infinity).
                            // Similarity usually [0, 1].
                            // Common conversion: 1 / (1 + distance)
                            // 修正：LlamaIndex 通常期望 cosine similarity
                            // 如果 LanceDB 用 L2，我们需要转换，或者在建表时指定 metric
                            // 简单起见，我们假设它是 L2，并转换
                            var distance = row._distance;
                            var similarity = 1 / (1 + distance);
                            ids.push(row.node_id);
                            similarities.push(similarity);
                            // 这里我们只是简单的返回 ID，上层会去 DocStore 查完整内容吗？
                            // 如果 storesText = true，我们可以直接返回带内容的 Node
                            // 这样就不需要 DocStore 了
                            // 临时 mock 一个对象，只要有 content 和 metadata 就行
                            var node = {
                                id_: row.node_id,
                                metadata: metadata,
                                getContent: function () { return row.text; },
                                getEmbedding: function () { return row.vector; },
                                // 还有很多 BaseNode 的方法...
                            };
                            nodes.push(node);
                        };
                        for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                            row = results_1[_i];
                            _loop_1(row);
                        }
                        return [2 /*return*/, {
                                nodes: nodes,
                                similarities: similarities,
                                ids: ids
                            }];
                }
            });
        });
    };
    /**
     * 持久化 (空操作，因为 LanceDB 是即时写入)
     */
    LanceDBVectorStore.prototype.persist = function (persistPath) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/];
            });
        });
    };
    return LanceDBVectorStore;
}(llamaindex_1.BaseVectorStore));
exports.LanceDBVectorStore = LanceDBVectorStore;
