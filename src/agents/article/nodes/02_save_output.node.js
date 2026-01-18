"use strict";
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
exports.saveOutputNode = saveOutputNode;
var fs_1 = require("fs");
var path_1 = require("path");
var uuid_1 = require("uuid");
/**
 * Save generated text to file system
 * Creates a unique run directory and persists the generated content
 *
 * @param state - Current article workflow state with generatedText
 * @returns Partial state with outputPath and updated status
 */
function saveOutputNode(state) {
    return __awaiter(this, void 0, void 0, function () {
        var runId, outputDir, files, path1, path2, path3, combinedPath, combinedContent;
        return __generator(this, function (_a) {
            console.log("[save_output] Saving all generated texts to file");
            runId = "article-".concat(Date.now(), "-").concat((0, uuid_1.v4)().substring(0, 8));
            outputDir = (0, path_1.join)(process.cwd(), "output", runId);
            (0, fs_1.mkdirSync)(outputDir, { recursive: true });
            files = [];
            if (state.generatedText) {
                path1 = (0, path_1.join)(outputDir, "01_standard.txt");
                (0, fs_1.writeFileSync)(path1, state.generatedText, "utf-8");
                files.push("01_standard.txt");
            }
            if (state.generatedText2) {
                path2 = (0, path_1.join)(outputDir, "02_concise.txt");
                (0, fs_1.writeFileSync)(path2, state.generatedText2, "utf-8");
                files.push("02_concise.txt");
            }
            if (state.generatedText3) {
                path3 = (0, path_1.join)(outputDir, "03_creative.txt");
                (0, fs_1.writeFileSync)(path3, state.generatedText3, "utf-8");
                files.push("03_creative.txt");
            }
            combinedPath = (0, path_1.join)(outputDir, "all_versions.txt");
            combinedContent = [
                "# 标准版本 (Node 1)\n\n",
                state.generatedText || "[未生成]",
                "\n\n---\n\n",
                "# 简洁版本 (Node 2)\n\n",
                state.generatedText2 || "[未生成]",
                "\n\n---\n\n",
                "# 创意版本 (Node 3)\n\n",
                state.generatedText3 || "[未生成]"
            ].join("");
            (0, fs_1.writeFileSync)(combinedPath, combinedContent, "utf-8");
            files.push("all_versions.txt");
            console.log("[save_output] Saved files:", files.join(", "));
            console.log("[save_output] Output directory:", outputDir);
            return [2 /*return*/, {
                    outputPath: outputDir,
                    status: "saved"
                }];
        });
    });
}
