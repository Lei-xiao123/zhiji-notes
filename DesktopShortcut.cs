using System;using System.IO;using System.Reflection;using System.Runtime.InteropServices;
class DesktopShortcut {
    static object Call(object target,string name,BindingFlags flag,params object[] args){return target.GetType().InvokeMember(name,flag,null,target,args);}
    public static string Create(){
        string root=StorageLayout.RootForExecutable(AppDomain.CurrentDomain.BaseDirectory);
        string exe=Path.Combine(root,"枝记.exe");
        if(!File.Exists(exe))exe=System.Reflection.Assembly.GetExecutingAssembly().Location;
        string desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        return Write(desktop,exe,root);
    }
    public static string Write(string desktop,string exe,string root){
        if(!File.Exists(exe))throw new FileNotFoundException("找不到枝记程序",exe);
        object shell=null,link=null;string destination=Path.Combine(desktop,"枝记.lnk");
        try {shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            if(File.Exists(destination)){
                link=Call(shell,"CreateShortcut",BindingFlags.InvokeMethod,destination);
                string previous=(string)Call(link,"TargetPath",BindingFlags.GetProperty);
                if(!String.Equals(previous,exe,StringComparison.OrdinalIgnoreCase)){
                    Marshal.FinalReleaseComObject(link);link=null;
                    destination=Path.Combine(desktop,"枝记（新版）.lnk");int n=2;
                    while(File.Exists(destination)){destination=Path.Combine(desktop,"枝记（新版 "+(n++)+"）.lnk");}
                }
            }
            if(link==null)link=Call(shell,"CreateShortcut",BindingFlags.InvokeMethod,destination);
            Call(link,"TargetPath",BindingFlags.SetProperty,exe);Call(link,"WorkingDirectory",BindingFlags.SetProperty,root);
            Call(link,"IconLocation",BindingFlags.SetProperty,exe+",0");Call(link,"Description",BindingFlags.SetProperty,"枝记 · 记录与整理你的想法");Call(link,"Save",BindingFlags.InvokeMethod);
            return destination;
        } finally {if(link!=null)Marshal.FinalReleaseComObject(link);if(shell!=null)Marshal.FinalReleaseComObject(shell);}
    }
}
