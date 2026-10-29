using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// The application owns its window; no browser title-bar patching is involved.
class NoteWindow : Form {
    WebView2 browser=new WebView2();
    string origin,profile;
    bool initialized=false,allowClose=false,closing=false;
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    public NoteWindow(string url,string folder,bool testing) {
        origin=url;profile=Path.Combine(folder,"WebView2");
        Text=testing?"枝记 · 窗口验证":"枝记";
        Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        FormBorderStyle=FormBorderStyle.None;
        StartPosition=FormStartPosition.CenterScreen;Size=new Size(1320,860);MinimumSize=new Size(960,640);
        BackColor=Color.FromArgb(235,232,242);Padding=new Padding(5);
        browser.Dock=DockStyle.Fill;Controls.Add(browser);
        Shown+=async delegate { await InitializeBrowser(); };
        FormClosing+=async delegate(object sender,FormClosingEventArgs e) {
            if(allowClose)return;
            e.Cancel=true;if(closing)return;closing=true;
            try {
                if(initialized) {
                    // Wait for an explicit message after the asynchronous save has completed.
                    await browser.ExecuteScriptAsync("(async()=>{try{if(typeof ready==='undefined'||!ready){chrome.webview.postMessage('close-ready');return;}finishEdit();for(let i=0;i<100&&saving;i++)await new Promise(r=>setTimeout(r,50));await save();chrome.webview.postMessage(savedVersion===changedVersion?'close-ready':'close-blocked');}catch{chrome.webview.postMessage('close-blocked');}})()");
                } else { allowClose=true;BeginInvoke(new System.Action(Close)); }
            } catch {closing=false;MessageBox.Show(this,"无法确认笔记已保存，请先导出备份后再关闭。","枝记");}
        };
    }
    async Task InitializeBrowser() {
        try {
            var env=await CoreWebView2Environment.CreateAsync(null,profile);
            await browser.EnsureCoreWebView2Async(env);
            browser.CoreWebView2.Settings.IsStatusBarEnabled=false;
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled=false;
            browser.CoreWebView2.WebMessageReceived+=delegate(object sender,CoreWebView2WebMessageReceivedEventArgs e) {
                if(!e.Source.StartsWith(origin+"/",StringComparison.OrdinalIgnoreCase))return;
                string message=e.TryGetWebMessageAsString();
                if(message=="close-ready" && closing){allowClose=true;BeginInvoke(new System.Action(Close));}
                if(message=="close-blocked"){closing=false;MessageBox.Show(this,"笔记保存未完成，请检查后重试，或先导出备份。","枝记");}
                if(message=="drag")Action("drag");
                if(message=="maximize")Action("maximize");
            };
            browser.CoreWebView2.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;OpenExternal(e.Uri);};
            browser.CoreWebView2.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){if(!e.Uri.StartsWith(origin+"/",StringComparison.OrdinalIgnoreCase)){e.Cancel=true;OpenExternal(e.Uri);}};
            browser.CoreWebView2.DownloadStarting+=async delegate(object sender,CoreWebView2DownloadStartingEventArgs e){
                using(var deferral=e.GetDeferral()){await Task.Yield();
                using(var dialog=new SaveFileDialog()){dialog.FileName=Path.GetFileName(e.ResultFilePath);dialog.Filter="所有文件|*.*";dialog.OverwritePrompt=true;e.Handled=true;if(dialog.ShowDialog(this)==DialogResult.OK)e.ResultFilePath=dialog.FileName;else e.Cancel=true;}}
            };
            initialized=true;browser.Source=new Uri(origin+"/");
        } catch(Exception ex) {
            MessageBox.Show(this,"窗口组件启动失败，请安装或修复 Microsoft Edge WebView2 Runtime 后重试。\n"+ex.Message,"枝记");
            allowClose=true;Close();
        }
    }
    static void OpenExternal(string address){Uri uri;if(Uri.TryCreate(address,UriKind.Absolute,out uri)&&(uri.Scheme=="https"||uri.Scheme=="http"))Process.Start(new ProcessStartInfo(address){UseShellExecute=true});}
    public void Action(string action) {
        if(action=="minimize")WindowState=FormWindowState.Minimized;
        else if(action=="maximize"){MaximizedBounds=Screen.FromHandle(Handle).WorkingArea;WindowState=WindowState==FormWindowState.Maximized?FormWindowState.Normal:FormWindowState.Maximized;}
        else if(action=="close")BeginInvoke(new System.Action(Close));
        else if(action=="drag" && GetAsyncKeyState(1)<0){ReleaseCapture();SendMessage(Handle,0x00A1,new IntPtr(2),IntPtr.Zero);}
    }
    protected override void WndProc(ref Message m) {
        const int WM_NCHITTEST=0x84;
        if(m.Msg==WM_NCHITTEST && WindowState==FormWindowState.Normal){
            long pos=m.LParam.ToInt64();Point p=PointToClient(new Point((short)(pos&0xffff),(short)((pos>>16)&0xffff)));
            bool left=p.X<5,right=p.X>=ClientSize.Width-5,top=p.Y<5,bottom=p.Y>=ClientSize.Height-5;
            int hit=top?(left?13:right?14:12):bottom?(left?16:right?17:15):left?10:right?11:0;
            if(hit!=0){m.Result=new IntPtr(hit);return;}
        }
        base.WndProc(ref m);
    }
}
