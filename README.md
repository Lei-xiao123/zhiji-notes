# 枝记 Zhiji

一个面向 Windows 的本地笔记工具，支持大纲笔记和思维导图。

## 功能

- 文件夹与文档管理、搜索、收藏和回收站。
- 大纲与思维导图切换，双击文字定位编辑，拖选文字后修改字体、字号、颜色和高亮。
- 图片插入、本地自动保存、撤销与重做、JSON 完整备份与导入。
- 五款界面主题、独立无标题栏窗口、桌面快捷方式和自定义图标。
- 数据与程序分目录存放；当前不提供账号登录或云同步。

## 构建

需要 64 位 Windows 10/11 和 .NET Framework 4.6.2 或更高版本。运行软件还需要 Microsoft Edge WebView2 Runtime。

在项目目录用 PowerShell 运行：

```powershell
.\build.ps1
```

首次构建从 NuGet 官方源下载固定版本 `Microsoft.Web.WebView2 1.0.3912.50` 到 `vendor/`，因此需要联网。编译器使用 Windows 自带的 .NET Framework C# 编译器，不需要 Visual Studio。已经恢复依赖后可以离线构建。

生成的程序为 `dist/Zhiji-v13.exe`，同目录的三个 DLL 需要保留。

构建可分享的完整压缩包：

```powershell
.\package.ps1
```

输出 `dist/Zhiji-Windows.zip`。打包脚本只复制明确列出的程序文件，不会复制已有安装目录或个人笔记。

## 使用与数据

完整解压发布包，双击根目录的 `枝记.exe`：

```text
枝记.exe
程序文件/  软件本体、运行组件和第三方许可
我的笔记/  notes.json、自动备份及初始化标记
缓存/      WebView2 数据
使用说明.txt
```

首次启动且目标目录没有笔记时，程序可能从当前电脑的旧版 `%LOCALAPPDATA%\枝记\notes.json` 复制数据。已有笔记不会覆盖，原文件也不会删除。

关闭软件后，复制“我的笔记”可备份数据。更新软件时保留该文件夹。发送给其他人的应当是重新构建的空白发布包。

**仓库仅包含程序源码、图标和测试代码，不包含个人笔记、图片附件、备份、缓存或使用历史。** 请勿取消 `.gitignore` 中的数据排除规则。

## 验证

测试需要 Node.js 22 或更高版本：

```powershell
node .\test-app.cjs
.\build.ps1
node .\test-native-window.cjs
node .\test-desktop.cjs
```

最后两个测试会创建独立的临时笔记库，不修改个人笔记。原生窗口测试需要 WebView2 Runtime。浏览器测试默认查找本机 Edge，也可以设置 `ZHIJI_TEST_BROWSER` 为 Chromium/Edge 可执行文件的完整路径。

## 结构

- `DesktopHost.cs`：本地 HTTP 服务与笔记存储接口。
- `NoteWindow.cs`：WinForms + WebView2 窗口。
- `StorageLayout.cs`、`DesktopShortcut.cs`、`ProgramLauncher.cs`：目录、快捷方式和启动入口。
- `app.html` 与各 JS/CSS 模块：笔记、编辑器、导图、图片、主题和导航。
- `assets/`：图标、预览图片及图标生成源码。

第三方 WebView2 许可由依赖包提供，打包时会附带。此仓库尚未指定开源许可证。
