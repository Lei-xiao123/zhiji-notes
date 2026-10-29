using System;
using System.IO;
using System.Web.Script.Serialization;
using System.Collections.Generic;

class StorageLayout {
    public string Root, Notes, Cache;
    public static string RootForExecutable(string directory) {
        var info=new DirectoryInfo(directory);
        return info.Name=="程序文件" ? info.Parent.FullName : info.FullName;
    }
    public static StorageLayout Initialize(string root,string legacy) {
        var layout=new StorageLayout {Root=Path.GetFullPath(root)};
        layout.Notes=Path.Combine(layout.Root,"我的笔记");layout.Cache=Path.Combine(layout.Root,"缓存");
        Directory.CreateDirectory(layout.Notes);Directory.CreateDirectory(layout.Cache);
        string target=Path.Combine(layout.Notes,"notes.json"),marker=Path.Combine(layout.Notes,".initialized");
        if(!File.Exists(marker)) {
            string source=Path.Combine(legacy,"notes.json");
            if(!File.Exists(target)&&File.Exists(source)) {
                var json=File.ReadAllText(source);
                var parser=new JavaScriptSerializer{MaxJsonLength=64*1024*1024,RecursionLimit=500};
                var data=parser.DeserializeObject(json) as Dictionary<string,object>;
                if(data==null||!data.ContainsKey("Documents"))throw new Exception("旧笔记格式异常，未迁移。原文件保持不变，请先检查或导出备份。");
                // Copy, never move: a failed upgrade cannot remove the original library.
                string temp=target+".migration.tmp";File.WriteAllText(temp,json,new System.Text.UTF8Encoding(false));File.Move(temp,target);
                File.WriteAllText(Path.Combine(layout.Notes,"迁移说明.txt"),"首次启动已从旧版位置复制笔记："+source+"\r\n原文件未删除。今后本版只读写此文件夹中的 notes.json。\r\n");
            }
            File.WriteAllText(marker,"Initialized "+DateTime.UtcNow.ToString("o"));
        }
        return layout;
    }
}
