using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Runtime.InteropServices;

class DesktopHost {
    static NoteWindow nativeWindow;
    static bool serverOnly=false;
    static string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "枝记");
    static string path = Path.Combine(folder, "notes.json");
    static string token = Guid.NewGuid().ToString("N");
    static object gate = new object();
    static DateTime lastSeen = DateTime.UtcNow;
    const int MaxBytes = 64 * 1024 * 1024;
    static JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = MaxBytes, RecursionLimit = 500 };
    [STAThread] static void Main(string[] args) {
#if PREVIEW
        args=new string[]{"--test-window",Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"..", ".test-runs", "v11-preview")};
#endif
        try { Run(args); } catch(Exception ex) { try { File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"startup-error.txt"), ex.ToString()); } catch {} MessageBox.Show("枝记无法启动：\n" + ex.Message, "枝记"); }
    }
    static void Run(string[] args) {
        bool testing=args.Length==2 && (args[0]=="--test-server" || args[0]=="--test-window");
        serverOnly=testing && args[0]=="--test-server";
        string cache;
        if(testing) { folder=Path.GetFullPath(args[1]);Directory.CreateDirectory(folder);cache=Path.Combine(folder,"缓存"); }
        else { var layout=StorageLayout.Initialize(StorageLayout.RootForExecutable(AppDomain.CurrentDomain.BaseDirectory),folder);folder=layout.Notes;cache=layout.Cache; }
        path=Path.Combine(folder,"notes.json");
        var socket = new TcpListener(IPAddress.Loopback, 0); socket.Start(); int port = ((IPEndPoint)socket.LocalEndpoint).Port; socket.Stop();
        string origin = "http://127.0.0.1:" + port;
        var listener = new TcpListener(IPAddress.Loopback, port); listener.Start();
        var html = ReadAsset("app.html").Replace("</head>","<style>"+ReadAsset("folder-images.css")+ReadAsset("workspace-ui.css")+ReadAsset("navigation-fonts.css")+ReadAsset("rich-text.css")+ReadAsset("inline-toolbar.css")+"</style></head>").Replace("<script src=\"folder-images.js\"></script>","<script>"+ReadAsset("folder-images.js")+"</script>").Replace("<script src=\"workspace-ui.js\"></script>","<script>"+ReadAsset("workspace-ui.js")+"</script>").Replace("<script src=\"navigation-fonts.js\"></script>","<script>"+ReadAsset("navigation-fonts.js")+"</script>").Replace("<script src=\"rich-text.js\"></script>","<script>"+ReadAsset("rich-text.js")+"</script>").Replace("<script src=\"inline-toolbar.js\"></script>","<script>"+ReadAsset("inline-toolbar.js")+"</script>").Replace("__SESSION_TOKEN__", token);
        if(testing) File.WriteAllText(Path.Combine(folder,"server-info.json"),serializer.Serialize(new { origin=origin, token=token }));
        ThreadStart serve=delegate {
            try { while(true) { var client=listener.AcceptTcpClient(); ThreadPool.QueueUserWorkItem(delegate { Handle(client, html, origin); }); } }
            catch(SocketException) { } catch(ObjectDisposedException) { }
        };
        if(serverOnly) { serve();return; }
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        nativeWindow=new NoteWindow(origin,cache,testing);
        var serverThread=new Thread(serve);serverThread.IsBackground=true;serverThread.Start();
        try { Application.Run(nativeWindow); } finally { listener.Stop(); }
    }
    static string ReadAsset(string name) { using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) using(var reader=new StreamReader(stream, Encoding.UTF8)) return reader.ReadToEnd(); }
    static void Handle(TcpClient client, string html, string origin) {
        using(client) {
        client.ReceiveTimeout=5000; client.SendTimeout=5000;
        var c = new LocalRequest(client.GetStream());
        try {
            c.ReadHeaders();
            string route=c.Route;
            if(route=="/") { Send(c,html,"text/html; charset=utf-8"); return; }
            if(c.Header("X-Zhiji-Token")!=token || (c.Header("Origin")!=null && c.Header("Origin")!=origin)) { c.Status=403; return; }
            lastSeen=DateTime.UtcNow;
            if(route.StartsWith("/api/window/") && c.Method=="POST") {
                string action=route.Substring("/api/window/".Length);
                object status=new { attached=false,serverOnly=serverOnly,maximized=false,caption=false };
                if(nativeWindow!=null && nativeWindow.IsHandleCreated && !nativeWindow.IsDisposed) {
                    status=nativeWindow.Invoke(new Func<object>(delegate {
                        nativeWindow.Action(action);
                        return new { attached=true,serverOnly=false,maximized=nativeWindow.WindowState==FormWindowState.Maximized,caption=nativeWindow.FormBorderStyle!=FormBorderStyle.None,clientTop=nativeWindow.PointToScreen(System.Drawing.Point.Empty).Y-nativeWindow.Top,clientHeight=nativeWindow.ClientSize.Height,windowHeight=nativeWindow.Height };
                    }));
                }
                Send(c,serializer.Serialize(status),"application/json");return;
            }
            if(route=="/api/desktop-shortcut" && c.Method=="POST") {
                if(serverOnly || nativeWindow==null){c.Status=400;Send(c,"{}","application/json");return;}
                var shortcut=(string)nativeWindow.Invoke(new Func<string>(DesktopShortcut.Create));
                Send(c,serializer.Serialize(new {created=true,path=shortcut}),"application/json");return;
            }
            if(route=="/api/open-notes" && c.Method=="POST") { if(!serverOnly)Process.Start(new ProcessStartInfo("explorer.exe","\""+folder+"\""){UseShellExecute=true});Send(c,"{}","application/json");return; }
            if(route=="/api/ping") { Send(c,"{}","application/json"); return; }
            if(route=="/api/library" && c.Method=="GET") { lock(gate) { Send(c,File.Exists(path) ? File.ReadAllText(path,Encoding.UTF8) : "{\"Documents\":[]}","application/json; charset=utf-8"); } return; }
            if(route=="/api/library" && c.Method=="POST") {
                string body=c.ReadBody();
                var parsed=serializer.DeserializeObject(body) as System.Collections.Generic.Dictionary<string,object>;
                if(parsed==null || !parsed.ContainsKey("Documents")) throw new Exception("笔记格式无效");
                lock(gate) { Directory.CreateDirectory(folder); string tmp=path+".tmp"; File.WriteAllText(tmp,body,new UTF8Encoding(false)); if(File.Exists(path)) File.Replace(tmp,path,path+".bak"); else File.Move(tmp,path); }
                Send(c,"{\"saved\":true}","application/json"); return;
            }
            c.Status=404;
        } catch(Exception ex) { try { c.Status=500; Send(c,serializer.Serialize(new { error=ex.Message }),"application/json"); } catch { } }
        finally { if(!c.Sent) try { Send(c,"{}","application/json"); } catch {} }
        }
    }
    static void Send(LocalRequest c,string value,string type) { c.Send(value,type); }
    class LocalRequest {
        NetworkStream stream;
        System.Collections.Generic.Dictionary<string,string> headers=new System.Collections.Generic.Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
        public string Route, Method; public int Status=200; public bool Sent=false;
        public LocalRequest(NetworkStream s) { stream=s; }
        public string Header(string name) { return headers.ContainsKey(name)?headers[name]:null; }
        string Line() { var b=new System.Collections.Generic.List<byte>(); int c; while((c=stream.ReadByte())!=-1) { if(c==10) break; if(c!=13)b.Add((byte)c); if(b.Count>16384)throw new Exception("请求头过长"); } if(c==-1&&b.Count==0)throw new IOException("连接已关闭"); return Encoding.ASCII.GetString(b.ToArray()); }
        public void ReadHeaders() { var first=Line().Split(' '); if(first.Length<2)throw new Exception("无效请求");Method=first[0];Route=first[1].Split('?')[0];for(int i=0;i<100;i++){var line=Line();if(line.Length==0)return;int index=line.IndexOf(':');if(index>0)headers[line.Substring(0,index)]=line.Substring(index+1).Trim();}throw new Exception("请求头过多"); }
        public string ReadBody() { int length;if(!Int32.TryParse(Header("Content-Length"),out length)||length<0||length>MaxBytes)throw new Exception("笔记数据超过 64 MB 容量");var bytes=new byte[length];int offset=0;while(offset<length){int n=stream.Read(bytes,offset,length-offset);if(n==0)throw new IOException("数据不完整");offset+=n;}return Encoding.UTF8.GetString(bytes); }
        public void Send(string value,string type) { byte[] bytes=Encoding.UTF8.GetBytes(value);var head=Encoding.ASCII.GetBytes("HTTP/1.1 "+Status+" "+(Status==200?"OK":"Error")+"\r\nContent-Type: "+type+"\r\nContent-Length: "+bytes.Length+"\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");stream.Write(head,0,head.Length);stream.Write(bytes,0,bytes.Length);Sent=true; }
    }
}
