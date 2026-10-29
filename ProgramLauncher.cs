using System;using System.IO;using System.Diagnostics;using System.Windows.Forms;
class ProgramLauncher {
    [STAThread]static void Main(){
        string root=AppDomain.CurrentDomain.BaseDirectory;
        string exe=Path.Combine(root,"程序文件","Zhiji-v13.exe");
        try{if(!File.Exists(exe))throw new Exception("缺少程序文件。请完整解压压缩包，不要单独移动启动程序。");Process.Start(new ProcessStartInfo(exe){UseShellExecute=false,WorkingDirectory=root});}
        catch(Exception e){MessageBox.Show(e.Message,"枝记");}
    }
}
